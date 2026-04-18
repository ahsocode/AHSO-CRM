"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, UserListItem } from "@/lib/types";

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    enabled,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<UserListItem[]>>("/users");
      return response.data.data;
    },
    retry: 0
  });
}
