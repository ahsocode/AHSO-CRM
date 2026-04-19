import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { getRoleName } from "../../auth/auth.types";
import { RoleValue } from "../constants/role.constants";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RoleValue[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: RoleValue | { name?: RoleValue } } | undefined;
    const roleName = getRoleName(user as { role?: RoleValue | { name?: RoleValue } });

    return Boolean(roleName && roles.includes(roleName as RoleValue));
  }
}
