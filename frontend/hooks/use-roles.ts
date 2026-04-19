"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, RoleUpsertInput, UserRole } from "@/lib/types";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<UserRole[]>>("/roles");
      return response.data.data;
    }
  });
}

export function useRole(roleId: string) {
  return useQuery({
    queryKey: ["roles", roleId],
    enabled: Boolean(roleId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<UserRole>>(`/roles/${roleId}`);
      return response.data.data;
    }
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RoleUpsertInput) => {
      const response = await apiClient.post<ApiResponse<UserRole>>("/roles", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    }
  });
}

export function useUpdateRole(roleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RoleUpsertInput) => {
      const response = await apiClient.patch<ApiResponse<UserRole>>(`/roles/${roleId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["roles", roleId] })
      ]);
    }
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/roles/${roleId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    }
  });
}
