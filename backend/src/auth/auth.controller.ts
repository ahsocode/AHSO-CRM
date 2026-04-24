import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, forgotPasswordSchema } from "./dto/forgot-password.dto";
import { LoginDto, loginSchema } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResetPasswordDto, resetPasswordSchema } from "./dto/reset-password.dto";

const REFRESH_COOKIE_NAME = "ahso_refresh_token";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const session = await this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.get("user-agent") ?? null
    });

    response.cookie(REFRESH_COOKIE_NAME, session.refreshToken, this.getRefreshCookieOptions());

    return {
      accessToken: session.accessToken,
      user: session.user
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("refresh")
  async refresh(
    @Body() body: Partial<RefreshTokenDto> | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = body?.refreshToken ?? this.getCookieValue(request, REFRESH_COOKIE_NAME);
    const session = await this.authService.refresh(refreshToken ?? "");

    response.cookie(REFRESH_COOKIE_NAME, session.refreshToken, this.getRefreshCookieOptions());

    return {
      accessToken: session.accessToken,
      user: session.user
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("forgot-password")
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = this.getCookieValue(request, REFRESH_COOKIE_NAME);

    if (refreshToken) {
      await this.authService.logoutByRefreshToken(refreshToken);
    }

    response.clearCookie(REFRESH_COOKIE_NAME, this.getBaseRefreshCookieOptions());

    return {
      success: true
    };
  }

  private getCookieValue(request: Request, name: string) {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const cookie = cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${name}=`));

    if (!cookie) {
      return null;
    }

    return decodeURIComponent(cookie.slice(name.length + 1));
  }

  private getRefreshCookieOptions() {
    return {
      ...this.getBaseRefreshCookieOptions(),
      maxAge: this.parseDurationToMs(
        this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d"
      )
    };
  }

  private getBaseRefreshCookieOptions() {
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development";

    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: nodeEnv === "production",
      path: "/"
    };
  }

  private parseDurationToMs(input: string) {
    const match = input.trim().match(/^(\d+)(ms|s|m|h|d)$/i);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier =
      unit === "ms"
        ? 1
        : unit === "s"
          ? 1000
          : unit === "m"
            ? 60_000
            : unit === "h"
              ? 3_600_000
              : 86_400_000;

    return value * multiplier;
  }
}
