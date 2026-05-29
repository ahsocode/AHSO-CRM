"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  Webhook,
  WebhookLog,
  WebhookCreateInput,
  WebhookUpdateInput,
} from "@/lib/types";

export function useWebhooks() {
  return useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Webhook[]>>("/webhooks");
      return response.data.data ?? [];
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WebhookCreateInput) => {
      const response = await apiClient.post<ApiResponse<Webhook>>(
        "/webhooks",
        payload
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: WebhookUpdateInput;
    }) => {
      const response = await apiClient.patch<ApiResponse<Webhook>>(
        `/webhooks/${id}`,
        payload
      );
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/webhooks/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useWebhookLogs(webhookId: string | null) {
  return useQuery({
    queryKey: ["webhook-logs", webhookId],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<WebhookLog[]>>(
        `/webhooks/${webhookId}/logs?limit=20`
      );
      return response.data.data ?? [];
    },
    enabled: !!webhookId,
  });
}
