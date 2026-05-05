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

  it("persists access token only in session storage and stores user profile separately", () => {
    persistSession(session);

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
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

  it("ignores legacy local storage access tokens", () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "legacy-token");

    expect(getAccessToken()).toBeNull();
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
