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

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DashboardKpis>>("/dashboard/kpis");
      return response.data.data;
    }
  });
}

export function useRevenueChart() {
  return useQuery({
    queryKey: ["dashboard", "revenue-chart"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<RevenueChartPoint[]>>("/dashboard/revenue-chart");
      return response.data.data;
    }
  });
}

export function usePipelinePreview() {
  return useQuery({
    queryKey: ["dashboard", "pipeline"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PipelineStage[]>>("/dashboard/pipeline");
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

export function useRecentActivity() {
  return useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<RecentActivityItem[]>>("/dashboard/recent-activity");
      return response.data.data;
    }
  });
}

