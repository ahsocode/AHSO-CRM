import axios from "axios";
import { API_URL, ACCESS_TOKEN_KEY } from "./constants";
import { clearSession, getAccessToken, getSessionId, persistSession } from "./auth";
import { ApiErrorPayload, ApiResponse, AuthSession } from "./types";

// Cross-tab session sync: when one tab refreshes tokens, broadcast to all others
// so they update sessionStorage without triggering a second refresh (which would
// fail because token rotation already invalidated the previous refresh token).
let sessionChannel: BroadcastChannel | null = null;

function getSessionChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  if (!sessionChannel) {
    sessionChannel = new BroadcastChannel("ahso-crm-session");
    sessionChannel.onmessage = (event) => {
      if (event.data?.type === "SESSION_REFRESHED" && event.data?.accessToken) {
        window.sessionStorage.setItem(ACCESS_TOKEN_KEY, event.data.accessToken);
      }
    };
  }
  return sessionChannel;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

let refreshRequest: Promise<string | null> | null = null;

apiClient.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  const sessionId = getSessionId();
  if (sessionId) {
    config.headers["X-Session-Id"] = sessionId;
  }

  return config;
});

// Initialise the BroadcastChannel as soon as the module loads in the browser.
if (typeof window !== "undefined") {
  getSessionChannel();
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window === "undefined") {
      return Promise.reject(error);
    }

    const originalRequest = error.config ?? {};
    const status = error.response?.status;
    const isRefreshCall = String(originalRequest.url ?? "").includes("/auth/refresh");

    if (status !== 401 || originalRequest._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshRequest) {
      refreshRequest = axios
        .post<ApiResponse<AuthSession>>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
        .then((response) => {
          const session = persistSession(response.data.data);
          // Tell all other open tabs about the new token so they don't need their own refresh.
          getSessionChannel()?.postMessage({
            type: "SESSION_REFRESHED",
            accessToken: session.accessToken
          });
          return session.accessToken;
        })
        .catch(() => {
          // Refresh failed. Do NOT call clearServerSession() (POST /auth/logout) here:
          // in a multi-tab scenario the cookie may already belong to a different tab that
          // just finished rotating the token — calling logout would destroy that tab's
          // valid session. Just clear local state and send the user to the login page.
          clearSession();
          window.location.href = "/login";
          return null;
        })
        .finally(() => {
          refreshRequest = null;
        });
    }

    const nextAccessToken = await refreshRequest;

    if (!nextAccessToken) {
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers ?? {};
    originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
    return apiClient.request(originalRequest);
  }
);

export function getApiErrorMessage(error: unknown, fallback = "Đã xảy ra lỗi, vui lòng thử lại.") {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const payload = error.response?.data;

    if (!error.response) {
      return `Không kết nối được API (${API_URL}). Kiểm tra cấu hình backend hoặc NEXT_PUBLIC_API_URL.`;
    }

    if (payload?.errors?.length) {
      return payload.errors.join("; ");
    }

    return payload?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
