import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_USER_KEY, ACCESS_TOKEN_KEY } from "@/lib/constants";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "./use-auth";

const session = {
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

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      isHydrated: false
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "http://localhost:3000/dashboard"
      }
    });
  });

  it("hydrates from the persisted user profile without requiring a localStorage token", () => {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "legacy-token");

    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({
      isHydrated: true,
      user: {
        id: "user-1",
        role: {
          name: "ADMIN",
          permissions: ["settings.edit"]
        }
      }
    });
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("legacy-token");
  });

  it("persists session and warms public settings after login", async () => {
    const postSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        data: session,
        meta: null
      }
    });
    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        data: {},
        meta: null
      }
    });

    await expect(
      useAuthStore.getState().login({
        email: "admin@ahso.vn",
        password: "AHSO123!"
      })
    ).resolves.toMatchObject({
      accessToken: "access-token",
      user: {
        id: "user-1"
      }
    });

    expect(postSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/login$/),
      {
        email: "admin@ahso.vn",
        password: "AHSO123!"
      },
      {
        withCredentials: true
      }
    );
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-token");
    expect(useAuthStore.getState().hasPermission("any.permission")).toBe(true);
    expect(getSpy).toHaveBeenCalledWith(expect.stringMatching(/\/settings\/company$/));
    expect(getSpy).toHaveBeenCalledWith(expect.stringMatching(/\/settings\/logo$/));
  });

  it("clears local session even when logout API fails", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network"));

    await useAuthStore.getState().logout();

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isHydrated: true
    });
    expect(window.location.href).toBe("/login");
  });
});
