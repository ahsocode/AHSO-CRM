import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtUser, getPermissionList, getRoleName, isAdmin } from "../../auth/auth.types";
import { PrismaService } from "../prisma.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

interface CachedPermissionEntry {
  expiresAt: number;
  permissions: string[];
  roleName?: string;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private static readonly cache = new Map<string, CachedPermissionEntry>();
  private static readonly ttlMs = 60_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser | undefined;

    if (!user?.sub) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }

    if (isAdmin(user)) {
      return true;
    }

    const permissions = await this.resolvePermissions(user);

    if (permissions.includes("*")) {
      return true;
    }

    if (!requiredPermissions.every((permission) => permissions.includes(permission))) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }

    return true;
  }

  private async resolvePermissions(user: JwtUser) {
    const embeddedPermissions = getPermissionList(user);

    if (embeddedPermissions.length > 0) {
      return embeddedPermissions;
    }

    const cachedPermissions = PermissionsGuard.cache.get(user.sub);

    if (cachedPermissions && cachedPermissions.expiresAt > Date.now()) {
      return cachedPermissions.permissions;
    }

    const userRecord = await this.prisma.user.findUnique({
      where: {
        id: user.sub
      },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                resource: true,
                action: true
              }
            }
          }
        }
      }
    });

    if (!userRecord?.role) {
      return [];
    }

    const roleName = getRoleName(userRecord.role);
    const permissions = roleName === "ADMIN"
      ? ["*"]
      : userRecord.role.permissions.map((permission) => `${permission.resource}.${permission.action}`);

    PermissionsGuard.cache.set(user.sub, {
      permissions,
      roleName,
      expiresAt: Date.now() + PermissionsGuard.ttlMs
    });

    return permissions;
  }
}
