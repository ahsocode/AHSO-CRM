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

  it("persists access token in session storage and fallback local storage", () => {
    persistSession(session);

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
    expect(getAccessToken()).toBe("access-token");
    expect(getStoredUser()).toMatchObject({
      id: "user-1",
      role: {
        name: "ADMIN",
        permissions: ["settings.edit"]
      }
    });
  });

  it("falls back to local storage when session storage is empty", () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "fallback-token");

    expect(getAccessToken()).toBe("fallback-token");
  });

  it("clears current session storage and legacy persisted state", () => {
    persistSession(session);
    clearSession();

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it("derives role names and permissions from normalized users", () => {
    expect(getAuthRoleName(session.user.role)).toBe("ADMIN");
    expect(getAuthPermissions(session.user)).toEqual(["settings.edit"]);
    expect(hasPermission(session.user, "any.permission")).toBe(true);
  });
});
