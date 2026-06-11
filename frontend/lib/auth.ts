import { API_URL, ACCESS_TOKEN_KEY, AUTH_USER_KEY, REFRESH_TOKEN_KEY, SESSION_ID_KEY, getRoleLabelByName } from "./constants";
import { AuthRoleInfo, AuthSession, AuthUser, Role } from "./types";

type NormalizedAuthUser = Omit<AuthUser, "role"> & { role: AuthRoleInfo };
type NormalizedAuthSession = Omit<AuthSession, "user"> & { user: NormalizedAuthUser };

function isBrowser() {
  return typeof window !== "undefined";
}

function safeLocalStorage() {
  if (!isBrowser()) return null;
  try {
    // In Safari Private mode or when "Block All Cookies" is enabled,
    // localStorage access can throw SecurityError or QuotaExceededError.
    window.localStorage.getItem("__test__");
    return window.localStorage;
  } catch {
    return null;
  }
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

  // Access token goes to sessionStorage ONLY — never localStorage (XSS risk).
  // User profile (non-secret) goes to localStorage for hydration after browser restart.
  const ls = safeLocalStorage();
  ls?.setItem(AUTH_USER_KEY, JSON.stringify(normalizedSession.user));

  return normalizedSession;
}

// Clears only this tab's session — does NOT touch localStorage so other
// open tabs remain logged in. Use this when a background token refresh
// fails (e.g. a new tab that opened before the token was propagated).
export function clearLocalSession() {
  getSessionStorage()?.removeItem(ACCESS_TOKEN_KEY);
  getSessionStorage()?.removeItem(SESSION_ID_KEY);
  clearLegacyClientCookies();
}

export function clearSession() {
  getSessionStorage()?.removeItem(ACCESS_TOKEN_KEY);
  getSessionStorage()?.removeItem(SESSION_ID_KEY);
  clearLegacyClientCookies();

  const ls = safeLocalStorage();
  ls?.removeItem(AUTH_USER_KEY);
}

export function getSessionId() {
  return getSessionStorage()?.getItem(SESSION_ID_KEY) ?? null;
}

export async function clearServerSession() {
  if (!isBrowser()) {
    return;
  }

  try {
    // Intentionally raw fetch, NOT apiClient: logout must not trigger the
    // 401-refresh interceptor (which would mint a new session while we are
    // tearing this one down) and must fire even when the access token is
    // already gone. Documented exception to the "always use apiClient" rule.
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch {
    // Best-effort cleanup. Local state is cleared by the caller even if the API is unavailable.
  }
}

export function getAccessToken() {
  // sessionStorage only — no localStorage fallback to prevent XSS token theft.
  // On browser restart the token is gone; the refresh-cookie interceptor re-issues it.
  return getSessionStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) {
    return null;
  }

  const rawUser = safeLocalStorage()?.getItem(AUTH_USER_KEY) ?? null;
  if (!rawUser) {
    return null;
  }

  try {
    return normalizeAuthUser(JSON.parse(rawUser) as AuthUser);
  } catch {
    return null;
  }
}
