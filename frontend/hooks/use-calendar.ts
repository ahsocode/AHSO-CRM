"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  CalendarEventItem,
  CalendarFilters,
  CalendarListMeta
} from "@/lib/types";

export function useCalendarEvents(filters: CalendarFilters) {
  return useQuery({
    queryKey: ["calendar", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CalendarEventItem[]>>("/calendar/events", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as CalendarListMeta
      };
    },
    // Keep data fresh longer to avoid rapid refetches
    staleTime: 10 * 60 * 1000,      // 10 minutes
    gcTime: 15 * 60 * 1000,         // 15 minutes
    refetchOnWindowFocus: false,    // Don't refetch on tab switch
    refetchOnReconnect: false,      // Don't refetch on network reconnect
  });
}
