import axios from "axios";
import { API_URL } from "./constants";
import { clearServerSession, clearSession, getAccessToken, getSessionId, persistSession } from "./auth";
import { ApiErrorPayload, ApiResponse, AuthSession } from "./types";

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
          persistSession(response.data.data);
          return response.data.data.accessToken;
        })
        .catch((refreshError) => {
          return clearServerSession().then(() => {
            clearSession();
            window.location.href = "/login";
            throw refreshError;
          });
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
