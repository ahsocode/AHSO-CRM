"use client";

import axios from "axios";
import { create } from "zustand";
import {
  clearSession,
  getStoredUser,
  hasPermission as authHasPermission,
  persistSession
} from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
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
  hasPermission: (permission: string) => boolean;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isHydrated: false,
  hydrate: () => {
    set({
      user: getStoredUser(),
      isHydrated: true
    });
  },
  login: async (input) => {
    const response = await axios.post<ApiResponse<AuthSession>>(`${API_URL}/auth/login`, input, {
      withCredentials: true
    });
    const session = persistSession(response.data.data);

    void Promise.allSettled([
      apiClient.get("/settings/company"),
      apiClient.get("/settings/logo")
    ]);

    set({
      user: session.user,
      isHydrated: true
    });
    return session;
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
    const response = await axios.post<ApiResponse<AuthSession>>(
      `${API_URL}/auth/refresh`,
      {},
      {
        withCredentials: true
      }
    );

    const session = persistSession(response.data.data);
    set({
      user: session.user,
      isHydrated: true
    });

    return session;
  },
  hasPermission: (permission) => authHasPermission(get().user, permission),
  logout: async () => {
    try {
      await axios.post(
        `${API_URL}/auth/logout`,
        {},
        {
          withCredentials: true
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
