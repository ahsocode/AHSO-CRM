"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  QuoteCreateInput,
  QuoteDetail,
  QuoteFilters,
  QuoteListItem,
  QuoteListMeta
} from "@/lib/types";

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
    }
  });
}
