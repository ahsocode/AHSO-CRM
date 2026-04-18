import { ACCESS_TOKEN_KEY, AUTH_USER_KEY, REFRESH_TOKEN_KEY } from "./constants";
import { AuthSession, AuthUser } from "./types";

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

export function persistSession(session: AuthSession) {
  setCookie(ACCESS_TOKEN_KEY, session.accessToken, 15 * 60);
  setCookie(REFRESH_TOKEN_KEY, session.refreshToken, 7 * 24 * 60 * 60);

  if (isBrowser()) {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  }
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
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

