import { RoleValue } from "../common/constants/role.constants";

export interface JwtRole {
  id: string;
  name: RoleValue | string;
  permissions: string[];
}

export interface JwtUser {
  sub: string;
  email: string;
  name: string;
  role: RoleValue | JwtRole;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PasswordResetTokenPayload {
  sub: string;
  email: string;
  type: "password-reset";
}

type RoleCarrier =
  | Pick<JwtUser, "role">
  | JwtRole
  | RoleValue
  | { role?: RoleValue | { name?: string } | null }
  | { name?: string }
  | null
  | undefined;

export function getRoleName(userOrRole?: RoleCarrier) {
  if (!userOrRole) {
    return undefined;
  }

  if (typeof userOrRole === "string") {
    return userOrRole;
  }

  if ("role" in userOrRole) {
    return typeof userOrRole.role === "string" ? userOrRole.role : userOrRole.role?.name;
  }

  return "name" in userOrRole ? userOrRole.name : undefined;
}

export function getPermissionList(user?: Pick<JwtUser, "permissions" | "role"> | null) {
  if (!user) {
    return [];
  }

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }

  return typeof user.role === "string" ? [] : user.role.permissions ?? [];
}

export function hasPermission(
  user: Pick<JwtUser, "permissions" | "role"> | null | undefined,
  permission: string
) {
  if (!user) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  return getPermissionList(user).includes(permission);
}

export function isAdmin(user?: Pick<JwtUser, "role"> | null) {
  return getRoleName(user) === "ADMIN";
}

export function isStaff(user?: Pick<JwtUser, "role"> | null) {
  return getRoleName(user) === "STAFF";
}
