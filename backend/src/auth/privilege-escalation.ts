import { ForbiddenException } from "@nestjs/common";
import { getPermissionList, isAdmin, JwtUser } from "./auth.types";

type PermissionRecord = { resource: string; action: string };

export function permissionKeys(permissions: PermissionRecord[]): string[] {
  return permissions.map((permission) => `${permission.resource}.${permission.action}`);
}

/**
 * Non-admin actors may only hand out what they already hold: never the ADMIN
 * role, and never a role/permission set containing permissions they lack.
 * Prevents MANAGER → ADMIN escalation via user role assignment or custom roles.
 */
export function assertCanGrant(
  actor: Pick<JwtUser, "role" | "permissions">,
  target: { roleName?: string | null; permissions: PermissionRecord[] }
) {
  if (isAdmin(actor)) {
    return;
  }

  if (target.roleName?.toUpperCase() === "ADMIN") {
    throw new ForbiddenException("Chỉ quản trị viên mới được cấp vai trò quản trị");
  }

  const held = new Set(getPermissionList(actor));
  const missing = permissionKeys(target.permissions).filter((key) => !held.has(key));
  if (missing.length > 0) {
    throw new ForbiddenException(
      `Không thể cấp quyền vượt quá quyền của bạn: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`
    );
  }
}
