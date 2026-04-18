import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthTokens, JwtUser } from "./auth.types";

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

  private buildPayload(user: User): JwtUser {
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
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

  private serializeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive
    };
  }
}
