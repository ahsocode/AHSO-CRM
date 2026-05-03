import { API_URL, ACCESS_TOKEN_KEY, AUTH_USER_KEY, REFRESH_TOKEN_KEY, SESSION_ID_KEY, getRoleLabelByName } from "./constants";
import { AuthRoleInfo, AuthSession, AuthUser, Role } from "./types";

type NormalizedAuthUser = Omit<AuthUser, "role"> & { role: AuthRoleInfo };
type NormalizedAuthSession = Omit<AuthSession, "user"> & { user: NormalizedAuthUser };

function isBrowser() {
  return typeof window !== "undefined";
}

function removeCookie(name: string) {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function getSessionStorage() {
  if (!isBrowser()) {
    return null;
  }

  return window.sessionStorage;
}

function clearLegacyClientCookies() {
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
}

function clearLegacyAccessCookie() {
  removeCookie(ACCESS_TOKEN_KEY);
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

  getSessionStorage()?.setItem(ACCESS_TOKEN_KEY, normalizedSession.accessToken);
  if (normalizedSession.sessionId) {
    getSessionStorage()?.setItem(SESSION_ID_KEY, normalizedSession.sessionId);
  }
  clearLegacyAccessCookie();

  if (isBrowser()) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedSession.user));
  }

  return normalizedSession;
}

export function clearSession() {
  getSessionStorage()?.removeItem(ACCESS_TOKEN_KEY);
  getSessionStorage()?.removeItem(SESSION_ID_KEY);
  clearLegacyClientCookies();

  if (isBrowser()) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
  }
}

export function getSessionId() {
  return getSessionStorage()?.getItem(SESSION_ID_KEY) ?? null;
}

export async function clearServerSession() {
  if (!isBrowser()) {
    return;
  }

  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch {
    // Best-effort cleanup. Local state is cleared by the caller even if the API is unavailable.
  }
}

export function getAccessToken() {
  return getSessionStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
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
