import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { tokenManager } from "./token-manager.js";

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let _client: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (_client) return _client;

  const baseURL = `${process.env["CRM_BASE_URL"] ?? "https://crm.ahso.vn"}/api`;

  const client = axios.create({
    baseURL,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
  });

  // Attach Bearer token trước mỗi request
  client.interceptors.request.use(async (config) => {
    const token = await tokenManager.getValidAccessToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // 401 → refresh một lần rồi retry
  client.interceptors.response.use(
    (res) => res,
    async (error: unknown) => {
      const err = error as { response?: { status: number }; config?: RetryableConfig };
      if (err.response?.status === 401 && err.config && !err.config._retry) {
        err.config._retry = true;
        tokenManager.invalidate();
        try {
          await tokenManager.getValidAccessToken();
        } catch {
          throw error;
        }
        return client.request(err.config);
      }
      throw error;
    }
  );

  _client = client;
  return client;
}

/**
 * Trích xuất data từ response chuẩn { data: T, meta: ... }
 */
export function extractData<T>(responseData: unknown): T {
  const d = responseData as Record<string, unknown>;
  if (d && typeof d === "object" && "data" in d) {
    return d["data"] as T;
  }
  return responseData as T;
}

export function extractMeta(responseData: unknown): {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} | null {
  const d = responseData as Record<string, unknown>;
  if (d && typeof d === "object" && "meta" in d && d["meta"]) {
    return d["meta"] as { total: number; page: number; limit: number; totalPages: number };
  }
  return null;
}
