import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { EmailService } from "../email/email.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthTokens, JwtUser, PasswordResetTokenPayload } from "./auth.types";

interface AuthRequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService
  ) {}

  async login(dto: LoginDto, meta?: AuthRequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException("Email hoặc mật khẩu không đúng");
    }

    const payload = this.buildPayload(user);
    const tokens = await this.issueTokens(payload);

    // Single-device enforcement: invalidate all existing sessions before creating new one
    await this.prisma.userSession.deleteMany({
      where: { userId: user.id }
    });
    const session = await this.createSession(user.id, tokens.refreshToken, meta);

    await this.auditService.recordLogin({
      userId: user.id,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null
    });

    return {
      ...tokens,
      sessionId: session.id,
      user: this.serializeUser(user)
    };
  }

  async refresh(refreshToken: string, meta?: AuthRequestMeta) {
    const { user, session } = await this.resolveUserFromRefreshToken(refreshToken);

    const nextPayload = this.buildPayload(user);
    const tokens = await this.issueTokens(nextPayload);

    // Rotate: update existing session with new token hash
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: hashedRefreshToken,
        lastActiveAt: new Date(),
        ipAddress: meta?.ip ?? session.ipAddress,
        userAgent: meta?.userAgent ?? session.userAgent
      }
    });

    return {
      ...tokens,
      sessionId: session.id,
      user: this.serializeUser(user)
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email
      }
    });

    if (!user || !user.isActive) {
      return this.buildForgotPasswordResponse();
    }

    const resetToken = await this.issuePasswordResetToken(user);
    const resetUrl = this.buildResetUrl(resetToken);

    await this.emailService.sendEmail(user.email, "Yêu cầu đặt lại mật khẩu AHSO CRM", "password-reset", {
      email: user.email,
      resetUrl,
      expiresIn: this.configService.get<string>("JWT_RESET_EXPIRES_IN") ?? "15 phút"
    });

    return this.buildForgotPasswordResponse(resetToken);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = this.decodePasswordResetToken(dto.token);
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub
      }
    });

    if (!user || !user.isActive || user.email !== payload.email) {
      throw new UnauthorizedException("Liên kết khôi phục không hợp lệ hoặc đã hết hạn");
    }

    try {
      await this.jwtService.verifyAsync<PasswordResetTokenPayload>(dto.token, {
        secret: this.buildPasswordResetSecret(user.password)
      });
    } catch {
      throw new UnauthorizedException("Liên kết khôi phục không hợp lệ hoặc đã hết hạn");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Invalidate all sessions when password is reset
    await this.prisma.userSession.deleteMany({
      where: { userId: user.id }
    });

    return {
      success: true,
      message: "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại."
    };
  }

  async logoutByRefreshToken(refreshToken: string) {
    if (!refreshToken) {
      return { success: true };
    }

    try {
      const { session } = await this.resolveUserFromRefreshToken(refreshToken);
      await this.prisma.userSession.delete({
        where: { id: session.id }
      });
    } catch {
      // Ignore invalid/expired tokens — cookie can still be cleared
    }

    return { success: true };
  }

  async getSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        lastActiveAt: true,
        createdAt: true
      }
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException("Phiên đăng nhập không tồn tại");
    }

    await this.prisma.userSession.delete({
      where: { id: sessionId }
    });

    return { success: true };
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        id: { not: currentSessionId }
      }
    });

    return { success: true };
  }

  private buildPayload(user: any): JwtUser {
    const permissions = user.role?.permissions?.map(
      (permission: { resource: string; action: string }) => `${permission.resource}.${permission.action}`
    ) ?? [];

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: {
        id: user.role?.id ?? "",
        name: user.role?.name || "STAFF",
        permissions
      },
      permissions
    };
  }

  private async issueTokens(payload: JwtUser): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_SECRET"),
        expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") ?? "15m"
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("JWT_SECRET"),
        expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d"
      })
    ]);

    return {
      accessToken,
      refreshToken
    };
  }

  private async issuePasswordResetToken(user: User) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        type: "password-reset"
      },
      {
        secret: this.buildPasswordResetSecret(user.password),
        expiresIn: this.configService.get<string>("JWT_RESET_EXPIRES_IN") ?? "15m"
      }
    );
  }

  private async createSession(userId: string, refreshToken: string, meta?: AuthRequestMeta) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    const deviceName = meta?.userAgent ? this.parseDeviceName(meta.userAgent) : null;

    return this.prisma.userSession.create({
      data: {
        userId,
        refreshToken: hashedRefreshToken,
        deviceName,
        ipAddress: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null
      }
    });
  }

  private parseDeviceName(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      if (/iPhone/i.test(userAgent)) return "iPhone";
      if (/iPad/i.test(userAgent)) return "iPad";
      if (/Android/i.test(userAgent)) return "Android";
      return "Mobile";
    }
    if (/Chrome/i.test(userAgent)) return "Chrome";
    if (/Firefox/i.test(userAgent)) return "Firefox";
    if (/Safari/i.test(userAgent)) return "Safari";
    if (/Edge/i.test(userAgent)) return "Edge";
    return "Trình duyệt";
  }

  private async resolveUserFromRefreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }

    let payload: JwtUser;

    try {
      payload = await this.jwtService.verifyAsync<JwtUser>(refreshToken, {
        secret: this.configService.get<string>("JWT_SECRET")
      });
    } catch {
      throw new UnauthorizedException("Refresh token không hợp lệ");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        sessions: true
      }
    });

    if (!user || !user.isActive || user.sessions.length === 0) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }

    // Find matching session by comparing refresh token hash
    let matchedSession: (typeof user.sessions)[0] | undefined;
    for (const session of user.sessions) {
      const matches = await bcrypt.compare(refreshToken, session.refreshToken);
      if (matches) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }

    return { payload, user, session: matchedSession };
  }

  private serializeUser(user: any) {
    const permissions = user.role?.permissions?.map(
      (permission: { resource: string; action: string }) => `${permission.resource}.${permission.action}`
    ) ?? [];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: {
        id: user.role?.id ?? "",
        name: user.role?.name || "STAFF",
        permissions
      },
      avatarUrl: user.avatarUrl,
      isActive: user.isActive
    };
  }

  private buildPasswordResetSecret(passwordHash: string) {
    const resetSecret =
      this.configService.get<string>("JWT_RESET_SECRET") ??
      this.configService.get<string>("JWT_SECRET");

    return `${resetSecret}:${passwordHash}`;
  }

  private decodePasswordResetToken(token: string) {
    const decoded = this.jwtService.decode(token);

    if (
      !decoded ||
      typeof decoded !== "object" ||
      !("sub" in decoded) ||
      !("email" in decoded) ||
      decoded.type !== "password-reset"
    ) {
      throw new UnauthorizedException("Liên kết khôi phục không hợp lệ hoặc đã hết hạn");
    }

    return decoded as PasswordResetTokenPayload;
  }

  private buildForgotPasswordResponse(resetToken?: string) {
    const message = "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được xếp vào hàng đợi gửi.";
    const isDevMode = this.configService.get<string>("NODE_ENV") === "development";
    const isDebugEnabled = this.configService.get<string>("DEBUG_RESET") === "true";

    if (!isDevMode || !isDebugEnabled || !resetToken) {
      return {
        success: true,
        message
      };
    }

    const resetUrl = this.buildResetUrl(resetToken);

    return {
      success: true,
      message,
      debug: {
        resetToken,
        resetUrl
      }
    };
  }

  private buildResetUrl(resetToken: string) {
    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ??
      (this.configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .find(Boolean) ??
      "http://localhost:3000";

    return `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
  }
}
