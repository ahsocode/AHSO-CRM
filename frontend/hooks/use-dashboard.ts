"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  DashboardActionItems,
  DashboardKpis,
  PipelineStage,
  RecentActivityItem,
  RevenueChartPoint
} from "@/lib/types";

export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
}

export function useDashboardKpis(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", "kpis", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DashboardKpis>>("/dashboard/kpis", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useRevenueChart(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", "revenue-chart", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<RevenueChartPoint[]>>("/dashboard/revenue-chart", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function usePipelinePreview(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", "pipeline", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PipelineStage[]>>("/dashboard/pipeline", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useActionItems() {
  return useQuery({
    queryKey: ["dashboard", "action-items"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DashboardActionItems>>("/dashboard/action-items");
      return response.data.data;
    }
  });
}

export function useRecentActivity(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ["dashboard", "recent-activity", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<RecentActivityItem[]>>("/dashboard/recent-activity", {
        params: filters
      });
      return response.data.data;
    }
  });
}
