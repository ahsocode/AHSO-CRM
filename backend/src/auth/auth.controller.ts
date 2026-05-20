import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtUser } from "./auth.types";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, forgotPasswordSchema } from "./dto/forgot-password.dto";
import { LoginDto, loginSchema } from "./dto/login.dto";
import { ResetPasswordDto, resetPasswordSchema } from "./dto/reset-password.dto";

const REFRESH_COOKIE_NAME = "ahso_refresh_token";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "POST /api/auth/login" })
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
      sessionId: session.sessionId,
      user: session.user
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "POST /api/auth/refresh" })
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = this.getCookieValue(request, REFRESH_COOKIE_NAME);
    const session = await this.authService.refresh(refreshToken ?? "", {
      ip: request.ip,
      userAgent: request.get("user-agent") ?? null
    });

    response.cookie(REFRESH_COOKIE_NAME, session.refreshToken, this.getRefreshCookieOptions());

    return {
      accessToken: session.accessToken,
      sessionId: session.sessionId,
      user: session.user
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "POST /api/auth/forgot-password" })
  @Post("forgot-password")
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "POST /api/auth/reset-password" })
  @Post("reset-password")
  resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: "POST /api/auth/logout" })
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

    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "GET /api/auth/sessions — list active sessions for current user" })
  @Get("sessions")
  getSessions(@CurrentUser() user: JwtUser) {
    return this.authService.getSessions(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "DELETE /api/auth/sessions/:id — revoke a specific session" })
  @Delete("sessions/:id")
  revokeSession(@CurrentUser() user: JwtUser, @Param("id") sessionId: string) {
    return this.authService.revokeSession(user.sub, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "DELETE /api/auth/sessions — revoke all other sessions (keep current)" })
  @Delete("sessions")
  revokeAllOtherSessions(
    @CurrentUser() user: JwtUser,
    @Req() request: Request
  ) {
    // sessionId header set by frontend after login to track current session
    const currentSessionId = request.headers["x-session-id"] as string | undefined;
    return this.authService.revokeAllOtherSessions(user.sub, currentSessionId ?? "");
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
    // 7 days — matches JWT_REFRESH_EXPIRES_IN so cookie and token expire together.
    // Session-only cookies are cleared by iOS when Safari is backgrounded.
    return { ...this.getBaseRefreshCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 };
  }

  private getBaseRefreshCookieOptions() {
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development";

    return {
      httpOnly: true,
      // "lax" (not "strict"): strict blocks the cookie on top-level navigations from
      // external links (email, home-screen icon, other apps) — the primary cause of
      // login failures on iPhone/Safari. Lax still prevents CSRF on state-changing
      // requests while allowing the cookie through on safe top-level GETs.
      sameSite: "lax" as const,
      secure: nodeEnv === "production",
      path: "/"
    };
  }
}
