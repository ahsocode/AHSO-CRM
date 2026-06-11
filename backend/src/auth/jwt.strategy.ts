import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../common/prisma.service";
import { AuthUserCache } from "./auth-user-cache";
import { JwtUser } from "./auth.types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET")
    });
  }

  /**
   * Hydrates request.user from the DB (60s cache) instead of trusting the
   * role/permissions embedded in the token. This means:
   * - deactivating a user revokes API access within 60s, not 15 minutes
   * - permission changes on a role take effect within 60s without re-login
   * The token payload is only used for identity (sub).
   */
  async validate(payload: JwtUser): Promise<JwtUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException("Token không hợp lệ");
    }

    const cached = AuthUserCache.get(payload.sub);
    if (cached) {
      if (!cached.user) {
        throw new UnauthorizedException("Tài khoản đã bị khóa hoặc không tồn tại");
      }
      return cached.user;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: {
              select: { resource: true, action: true }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      AuthUserCache.set(payload.sub, null);
      throw new UnauthorizedException("Tài khoản đã bị khóa hoặc không tồn tại");
    }

    const permissions =
      user.role?.permissions?.map(
        (permission) => `${permission.resource}.${permission.action}`
      ) ?? [];

    const hydrated: JwtUser = {
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

    AuthUserCache.set(payload.sub, hydrated);
    return hydrated;
  }
}
