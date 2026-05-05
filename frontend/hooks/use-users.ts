"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, UserCreateInput, UserListItem, UserUpdateInput } from "@/lib/types";

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
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UserCreateInput) => {
      const response = await apiClient.post<ApiResponse<UserListItem>>("/users", payload);
      return response.data.data;
    },
    onSuccess: async (createdUser) => {
      queryClient.setQueryData<UserListItem[]>(["users"], (current) => {
        const users = current ?? [];
        const nextUsers = users.some((user) => user.id === createdUser.id)
          ? users.map((user) => (user.id === createdUser.id ? createdUser : user))
          : [...users, createdUser];

        return [...nextUsers].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        );
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}
