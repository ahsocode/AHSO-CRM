import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./constants";
import type { AuthSession } from "./types";

const nextSession: AuthSession = {
  accessToken: "next-access-token",
  user: {
    id: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    avatarUrl: null,
    isActive: true,
    role: {
      id: "role-admin",
      name: "ADMIN",
      permissions: []
    }
  }
};

function createResponse(config: AxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {
      ...config,
      headers: new AxiosHeaders()
    } as InternalAxiosRequestConfig
  };
}

describe("apiClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "http://localhost:3000/dashboard"
      }
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("adds bearer token from auth storage to outgoing requests", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "stored-access-token");
    const { apiClient } = await import("./api-client");

    let observedAuthorization: unknown;
    apiClient.defaults.adapter = async (config) => {
      observedAuthorization = config.headers?.Authorization;
      return createResponse(config, { data: { ok: true }, meta: null });
    };

    await apiClient.get("/dashboard/kpis");

    expect(observedAuthorization).toBe("Bearer stored-access-token");
  });

  it("refreshes once after a 401 and retries the original request with the next token", async () => {
    const refreshSpy = vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        data: nextSession,
        meta: null
      }
    });
    const { apiClient } = await import("./api-client");
    let requestCount = 0;
    const retryAuthorizations: unknown[] = [];

    apiClient.defaults.adapter = async (config) => {
      requestCount += 1;
      retryAuthorizations.push(config.headers?.Authorization);

      if (requestCount === 1) {
        return Promise.reject({
          config,
          response: {
            status: 401
          }
        });
      }

      return createResponse(config, { data: { ok: true }, meta: null });
    };

    await expect(apiClient.get("/customers")).resolves.toMatchObject({
      data: {
        data: {
          ok: true
        }
      }
    });

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(requestCount).toBe(2);
    expect(retryAuthorizations).toEqual([undefined, "Bearer next-access-token"]);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("next-access-token");
  });

  it("clears local session and redirects to login when refresh fails without calling the logout API", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "expired-access-token");
    vi.spyOn(axios, "post").mockRejectedValue(new Error("refresh failed"));
    const { apiClient } = await import("./api-client");

    apiClient.defaults.adapter = async (config) =>
      Promise.reject({
        config,
        response: {
          status: 401
        }
      });

    // Rejects with the original 401 error (not the refresh failure — that is swallowed).
    await expect(apiClient.get("/customers")).rejects.toMatchObject({ response: { status: 401 } });
    // Must NOT call POST /auth/logout: in a multi-tab scenario the refresh-token cookie may
    // already belong to another tab that just succeeded — calling logout would destroy its session.
    expect(fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.location.href).toBe("/login");
  });
});
