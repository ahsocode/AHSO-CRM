"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, CompanyInfo, Policies, PolicyItem, PolicyItemType } from "@/lib/types";

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
      queryClient.setQueryData<CompanyInfo>(["settings", "company"], updatedCompany);
      void queryClient.invalidateQueries({ queryKey: ["settings"], exact: true });
      void queryClient.invalidateQueries({ queryKey: ["settings", "company"], exact: true });
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

// ── Policy Items ──────────────────────────────────────────────

export function usePolicyItems(type?: PolicyItemType) {
  return useQuery({
    queryKey: ["policy-items", type ?? "all"],
    queryFn: async () => {
      const params = type ? `?type=${type}` : "";
      const response = await apiClient.get<ApiResponse<PolicyItem[]>>(`/policy-items${params}`);
      return response.data.data ?? [];
    }
  });
}

export function useCreatePolicyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { type: PolicyItemType; name: string; content: string; isDefault?: boolean; sortOrder?: number }) => {
      const response = await apiClient.post<ApiResponse<PolicyItem>>("/policy-items", payload);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["policy-items"] })
  });
}

export function useUpdatePolicyItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; content?: string; isDefault?: boolean; sortOrder?: number }) => {
      const response = await apiClient.patch<ApiResponse<PolicyItem>>(`/policy-items/${id}`, payload);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["policy-items"] })
  });
}

export function useDeletePolicyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/policy-items/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["policy-items"] })
  });
}
