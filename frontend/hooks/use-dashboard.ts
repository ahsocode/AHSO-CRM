"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  DashboardKpis,
  DashboardTask,
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

export function useTasksToday() {
  return useQuery({
    queryKey: ["dashboard", "tasks-today"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DashboardTask[]>>("/dashboard/tasks-today");
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
