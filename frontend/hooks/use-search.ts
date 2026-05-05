"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, SearchResultItem } from "@/lib/types";

export function useGlobalSearch(query: string, limit = 8, enabled = true) {
  const trimmedQuery = query.trim();

  return useQuery({
    enabled: enabled && trimmedQuery.length >= 2,
    queryKey: ["search", "global", trimmedQuery, limit],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<SearchResultItem[]>>("/search/global", {
        params: {
          q: trimmedQuery,
          limit
        }
      });

      return response.data.data;
    }
  });
}
