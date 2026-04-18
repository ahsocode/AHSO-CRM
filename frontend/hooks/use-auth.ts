"use client";

import axios from "axios";
import { create } from "zustand";
import { clearSession, getAccessToken, getRefreshToken, getStoredUser, persistSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { ActionResponse, ApiResponse, AuthSession, AuthUser, ForgotPasswordResponse } from "@/lib/types";

interface LoginInput {
  email: string;
  password: string;
}

interface ForgotPasswordInput {
  email: string;
}

interface ResetPasswordInput {
  token: string;
  password: string;
  confirmPassword: string;
}

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  hydrate: () => void;
  login: (input: LoginInput) => Promise<AuthSession>;
  requestPasswordReset: (input: ForgotPasswordInput) => Promise<ForgotPasswordResponse>;
  resetPassword: (input: ResetPasswordInput) => Promise<ActionResponse>;
  refreshSession: () => Promise<AuthSession>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  hydrate: () => {
    set({
      user: getStoredUser(),
      isHydrated: true
    });
  },
  login: async (input) => {
    const response = await axios.post<ApiResponse<AuthSession>>(`${API_URL}/auth/login`, input);
    persistSession(response.data.data);
    set({
      user: response.data.data.user,
      isHydrated: true
    });
    return response.data.data;
  },
  requestPasswordReset: async (input) => {
    const response = await axios.post<ApiResponse<ForgotPasswordResponse>>(`${API_URL}/auth/forgot-password`, input);
    return response.data.data;
  },
  resetPassword: async (input) => {
    const response = await axios.post<ApiResponse<ActionResponse>>(`${API_URL}/auth/reset-password`, input);
    return response.data.data;
  },
  refreshSession: async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearSession();
      set({
        user: null,
        isHydrated: true
      });
      throw new Error("Không tìm thấy refresh token");
    }

    const response = await axios.post<ApiResponse<AuthSession>>(`${API_URL}/auth/refresh`, {
      refreshToken
    });

    persistSession(response.data.data);
    set({
      user: response.data.data.user,
      isHydrated: true
    });
    return response.data.data;
  },
  logout: async () => {
    try {
      const accessToken = getAccessToken();
      await axios.post(
        `${API_URL}/auth/logout`,
        {},
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
        }
      );
    } catch {
      // Ignore logout API failures and clear local session regardless.
    } finally {
      clearSession();
      set({
        user: null,
        isHydrated: true
      });
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }
}));

export function useAuth() {
  return useAuthStore();
}
