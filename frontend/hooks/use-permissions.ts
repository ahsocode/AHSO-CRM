"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, PermissionGroup } from "@/lib/types";

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PermissionGroup[]>>("/permissions");
      return response.data.data;
    }
  });
}

export function usePermissionResources() {
  return useQuery({
    queryKey: ["permissions", "resources"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<string[]>>("/permissions/resources");
      return response.data.data;
    }
  });
}
