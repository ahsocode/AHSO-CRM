import { describe, expect, it } from "vitest";
import {
  clearSession,
  getAccessToken,
  getAuthPermissions,
  getAuthRoleName,
  getStoredUser,
  hasPermission,
  normalizeAuthRole,
  persistSession
} from "./auth";
import { ACCESS_TOKEN_KEY, AUTH_USER_KEY } from "./constants";
import type { AuthSession } from "./types";

const session: AuthSession = {
  accessToken: "access-token",
  user: {
    id: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    avatarUrl: null,
    isActive: true,
    role: {
      id: "role-admin",
      name: "ADMIN",
      permissions: ["settings.edit"]
    }
  }
};

describe("auth helpers", () => {
  it("normalizes legacy string roles into the current role object shape", () => {
    expect(normalizeAuthRole("MANAGER")).toEqual({
      id: "",
      name: "MANAGER",
      permissions: []
    });
  });

  it("persists access token in session storage only (not localStorage)", () => {
    persistSession(session);

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
    // Token must NOT be written to localStorage — XSS scripts can read localStorage
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(getAccessToken()).toBe("access-token");
    expect(getStoredUser()).toMatchObject({
      id: "user-1",
      role: {
        name: "ADMIN",
        permissions: ["settings.edit"]
      }
    });
  });

  it("returns null when only localStorage has the token (no sessionStorage fallback)", () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "cross-tab-token");

    // Security: localStorage fallback removed — token must come from sessionStorage only
    expect(getAccessToken()).toBeNull();
  });

  it("clears session storage and user profile from local storage", () => {
    persistSession(session);
    clearSession();

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    // Access token was never written to localStorage, but clearSession must not leave user profile
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it("derives role names and permissions from normalized users", () => {
    expect(getAuthRoleName(session.user.role)).toBe("ADMIN");
    expect(getAuthPermissions(session.user)).toEqual(["settings.edit"]);
    expect(hasPermission(session.user, "any.permission")).toBe(true);
  });
});
