"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  ReportStatusBreakdown,
  ReportTopCustomer,
  ReportsOverview,
  RevenueChartPoint
} from "@/lib/types";

interface ReportFilters {
  months: number;
  topLimit?: number;
}

export function useReportsOverview(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "overview", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportsOverview>>("/reports/overview", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useReportsRevenueTrend(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "revenue-trend", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<RevenueChartPoint[]>>("/reports/revenue-trend", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useReportsStatusBreakdown(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "status-breakdown", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportStatusBreakdown>>("/reports/status-breakdown", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useReportsTopCustomers(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "top-customers", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportTopCustomer[]>>("/reports/top-customers", {
        params: filters
      });
      return response.data.data;
    }
  });
}
