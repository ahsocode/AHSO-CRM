"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, UserListItem, UserUpdateInput } from "@/lib/types";

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

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload
    }: {
      userId: string;
      payload: UserUpdateInput;
    }) => {
      const response = await apiClient.patch<ApiResponse<UserListItem>>(`/users/${userId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    }
  });
}
