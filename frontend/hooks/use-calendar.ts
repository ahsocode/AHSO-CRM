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
    // Keep data fresh for 5 minutes, avoid rapid refetch on view switches
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
