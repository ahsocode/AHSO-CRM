import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthTokens, JwtUser, PasswordResetTokenPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(dto: LoginDto) {
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
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.serializeUser(user)
    };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: JwtUser;

    try {
      payload = await this.jwtService.verifyAsync<JwtUser>(dto.refreshToken, {
        secret: this.configService.get<string>("JWT_SECRET")
      });
    } catch {
      throw new UnauthorizedException("Refresh token không hợp lệ");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub
      },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });

    if (!user || !user.refreshToken || !user.isActive) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }

    const isValidRefreshToken = await bcrypt.compare(dto.refreshToken, user.refreshToken);

    if (!isValidRefreshToken) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn");
    }

    const nextPayload = this.buildPayload(user);
    const tokens = await this.issueTokens(nextPayload);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
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

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        password: hashedPassword,
        refreshToken: null
      }
    });

    return {
      success: true,
      message: "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại."
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        refreshToken: null
      }
    });

    return {
      success: true
    };
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

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        refreshToken: hashedRefreshToken
      }
    });
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
      this.configService.get<string>("JWT_SECRET") ??
      "ahso-reset-secret";

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
    const isDevelopment = (this.configService.get<string>("NODE_ENV") ?? "development") !== "production";

    if (!isDevelopment || !resetToken) {
      return {
        success: true,
        message
      };
    }

    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ??
      (this.configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .find(Boolean) ??
      "http://localhost:3000";
    const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;

    return {
      success: true,
      message,
      debug: {
        resetToken,
        resetUrl
      }
    };
  }
}
