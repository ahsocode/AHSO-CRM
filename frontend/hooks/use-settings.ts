"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, CompanyInfo, Policies } from "@/lib/types";

interface SettingsBundle {
  company: CompanyInfo;
  policies: Policies;
  logo: string | null;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<SettingsBundle>>("/settings");
      return response.data.data;
    }
  });
}

export function useCompanyInfo() {
  return useQuery({
    queryKey: ["settings", "company"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CompanyInfo>>("/settings/company");
      return response.data.data;
    }
  });
}

export function usePolicies() {
  return useQuery({
    queryKey: ["settings", "policies"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Policies>>("/settings/policies");
      return response.data.data;
    }
  });
}

export function useLogo() {
  return useQuery({
    queryKey: ["settings", "logo"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<string | null>>("/settings/logo");
      return response.data.data;
    }
  });
}

export function useUpdateCompanyInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CompanyInfo) => {
      const response = await apiClient.patch<ApiResponse<CompanyInfo>>("/settings/company", payload);
      return response.data.data;
    },
    onSuccess: (updatedCompany) => {
      // Immediately update the settings bundle cache so the form reflects saved values
      // without waiting for a background refetch. Use exact:true so we don't trigger
      // the public GET /settings/company endpoint (which only returns 7 fields).
      queryClient.setQueryData<SettingsBundle>(["settings"], (old) =>
        old ? { ...old, company: updatedCompany } : old
      );
      void queryClient.invalidateQueries({ queryKey: ["settings"], exact: true });
    }
  });
}

export function useUpdatePolicies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Policies) => {
      const response = await apiClient.patch<ApiResponse<Policies>>("/settings/policies", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "policies"] })
      ]);
    }
  });
}
