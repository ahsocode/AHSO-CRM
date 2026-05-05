"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  QuoteCreateInput,
  QuoteDetail,
  QuoteFilters,
  QuoteListItem,
  QuoteListMeta,
  QuoteStatus,
  QuoteStatusUpdateInput,
  QuoteUpdateInput
} from "@/lib/types";
import { getFilenameFromContentDisposition } from "@/lib/utils";

export function useQuotes(filters: QuoteFilters) {
  return useQuery({
    queryKey: ["quotes", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<QuoteListItem[]>>("/quotes", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as QuoteListMeta
      };
    }
  });
}

export function useQuote(quoteId: string) {
  return useQuery({
    queryKey: ["quotes", quoteId],
    enabled: Boolean(quoteId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<QuoteDetail>>(`/quotes/${quoteId}`);
      return response.data.data;
    }
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: QuoteCreateInput) => {
      const response = await apiClient.post<ApiResponse<{ id: string; quoteNo: string }>>("/quotes", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useUpdateQuote(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: QuoteUpdateInput) => {
      const response = await apiClient.patch<ApiResponse<{ id: string; quoteNo: string }>>(
        `/quotes/${quoteId}`,
        payload
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      await queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useDuplicateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiClient.post<ApiResponse<{ id: string; quoteNo: string; version: number }>>(
        `/quotes/${quoteId}/duplicate`
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quoteId,
      payload
    }: {
      quoteId: string;
      payload: QuoteStatusUpdateInput;
    }) => {
      const response = await apiClient.patch<
        ApiResponse<{ id: string; status: QuoteStatus; sentAt?: string | null; acceptedAt?: string | null }>
      >(`/quotes/${quoteId}/status`, payload);
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      await queryClient.invalidateQueries({ queryKey: ["quotes", variables.quoteId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useDownloadQuotePdf() {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiClient.get<Blob>(`/quotes/${quoteId}/pdf`, {
        responseType: "blob"
      });

      return {
        blob: response.data,
        filename: getFilenameFromContentDisposition(response.headers["content-disposition"], `quote-${quoteId}.pdf`)
      };
    }
  });
}

export function useDeleteQuote(quoteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/quotes/${quoteId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useBulkQuotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { action: "status" | "send" | "export" | "delete"; ids: string[]; status?: QuoteStatus }) => {
      const response = await apiClient.post<ApiResponse<{ action: string; processedCount?: number; items?: Record<string, unknown>[] }>>(
        "/quotes/bulk",
        payload
      );
      return response.data.data;
    },
    onSuccess: async (data) => {
      if (data.action !== "export") {
        await queryClient.invalidateQueries({ queryKey: ["quotes"] });
        await queryClient.invalidateQueries({ queryKey: ["projects"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        await queryClient.invalidateQueries({ queryKey: ["reports"] });
      }
    }
  });
}
