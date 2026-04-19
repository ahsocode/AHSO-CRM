"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { ApiResponse, NotificationFilters, NotificationItem, NotificationListMeta } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

export function useNotifications(filters: NotificationFilters) {
  return useQuery({
    queryKey: ["notifications", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<NotificationItem[]>>("/notifications", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as NotificationListMeta
      };
    }
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<{ unreadCount: number }>>("/notifications/unread-count");
      return response.data.data.unreadCount;
    }
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<ApiResponse<{ success: boolean }>>(`/notifications/${id}/read`);
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
      ]);
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể đánh dấu thông báo đã đọc."),
        variant: "destructive"
      });
    }
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.patch<ApiResponse<{ success: boolean; updatedCount: number }>>(
        "/notifications/read-all"
      );
      return response.data.data;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
      ]);

      if (data.updatedCount > 0) {
        toast(`Đã đánh dấu ${data.updatedCount} thông báo là đã đọc.`);
      }
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể cập nhật tất cả thông báo."),
        variant: "destructive"
      });
    }
  });
}
