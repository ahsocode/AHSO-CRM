import { API_URL, ACCESS_TOKEN_KEY, AUTH_USER_KEY, REFRESH_TOKEN_KEY, getRoleLabelByName } from "./constants";
import { AuthRoleInfo, AuthSession, AuthUser, Role } from "./types";

type NormalizedAuthUser = Omit<AuthUser, "role"> & { role: AuthRoleInfo };
type NormalizedAuthSession = Omit<AuthSession, "user"> & { user: NormalizedAuthUser };

function isBrowser() {
  return typeof window !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function getCookie(name: string) {
  if (!isBrowser()) {
    return null;
  }

  const cookies = document.cookie.split("; ").filter(Boolean);
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

function removeCookie(name: string) {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function normalizeAuthRole(role: AuthUser["role"] | null | undefined): AuthRoleInfo {
  if (!role) {
    return {
      id: "",
      name: "STAFF",
      permissions: []
    };
  }

  if (typeof role === "string") {
    return {
      id: "",
      name: role,
      permissions: []
    };
  }

  return {
    id: role?.id ?? "",
    name: (role?.name ?? "STAFF") as Role,
    permissions: Array.isArray(role?.permissions) ? role.permissions : []
  };
}

export function normalizeAuthUser(user: AuthUser | null | undefined): NormalizedAuthUser | null {
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: normalizeAuthRole(user.role)
  };
}

export function normalizeAuthSession(session: AuthSession): NormalizedAuthSession {
  return {
    ...session,
    user: normalizeAuthUser(session.user) ?? session.user
  } as NormalizedAuthSession;
}

export function getAuthRoleName(role: AuthUser["role"] | null | undefined): Role | undefined {
  if (!role) {
    return undefined;
  }

  return normalizeAuthRole(role).name;
}

export function getAuthPermissions(user: AuthUser | null | undefined) {
  return normalizeAuthUser(user)?.role.permissions ?? [];
}

export function getRoleLabel(role: AuthUser["role"] | null | undefined) {
  const roleName = getAuthRoleName(role);
  return roleName ? getRoleLabelByName(roleName) : "Phiên làm việc";
}

export function isLeadershipRole(role: AuthUser["role"] | null | undefined) {
  const roleName = getAuthRoleName(role);
  return roleName === "ADMIN" || roleName === "MANAGER";
}

export function hasPermission(user: AuthUser | null | undefined, permission: string) {
  const roleName = getAuthRoleName(user?.role);

  if (roleName === "ADMIN") {
    return true;
  }

  return getAuthPermissions(user).includes(permission);
}

export function resolveAssetUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, API_URL).toString();
  } catch {
    return url;
  }
}

export function persistSession(session: AuthSession) {
  const normalizedSession = normalizeAuthSession(session);

  setCookie(ACCESS_TOKEN_KEY, normalizedSession.accessToken, 15 * 60);
  setCookie(REFRESH_TOKEN_KEY, normalizedSession.refreshToken, 7 * 24 * 60 * 60);

  if (isBrowser()) {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedSession.user));
  }

  return normalizedSession;
}

export function clearSession() {
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);

  if (isBrowser()) {
    window.localStorage.removeItem(AUTH_USER_KEY);
  }
}

export function getAccessToken() {
  return getCookie(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }

  const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return normalizeAuthUser(JSON.parse(rawUser) as AuthUser);
  } catch {
    return null;
  }
}
