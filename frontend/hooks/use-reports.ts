"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  ReportBuilderConfig,
  ReportCohortRow,
  ReportFunnelItem,
  ReportHeatmapCell,
  ReportStatusBreakdown,
  ReportSankeyLink,
  ReportSankeyNode,
  ReportTemplate,
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

export function useReportsCustomerJourney(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "customer-journey", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<{ nodes: ReportSankeyNode[]; links: ReportSankeyLink[] }>>(
        "/reports/customer-journey",
        {
          params: filters
        }
      );
      return response.data.data;
    }
  });
}

export function useReportsActivityHeatmap(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "activity-heatmap", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportHeatmapCell[]>>("/reports/activity-heatmap", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useReportsFunnel(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "funnel", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportFunnelItem[]>>("/reports/funnel", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useReportsCohort(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "cohort", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportCohortRow[]>>("/reports/cohort", {
        params: filters
      });
      return response.data.data;
    }
  });
}

export function useRunCustomReportQuery() {
  return useMutation({
    mutationFn: async (config: ReportBuilderConfig) => {
      const response = await apiClient.post<
        ApiResponse<{
          rows: Record<string, unknown>[];
          summary: {
            dataset: string;
            rowCount: number;
          };
          chartData: Record<string, unknown>[];
        }>
      >("/reports/custom/query", config);

      return response.data.data;
    }
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: ["reports", "templates"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ReportTemplate[]>>("/reports/templates");
      return response.data.data;
    }
  });
}

export function useCreateReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      resource: ReportTemplate["resource"];
      isShared?: boolean;
      config: ReportBuilderConfig;
    }) => {
      const response = await apiClient.post<ApiResponse<ReportTemplate>>("/reports/templates", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports", "templates"] });
    }
  });
}

export function useUpdateReportTemplate(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<{
      name: string;
      description?: string;
      resource: ReportTemplate["resource"];
      isShared?: boolean;
      config: ReportBuilderConfig;
    }>) => {
      const response = await apiClient.patch<ApiResponse<ReportTemplate>>(`/reports/templates/${templateId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports", "templates"] });
    }
  });
}

export function useDeleteReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/reports/templates/${templateId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports", "templates"] });
    }
  });
}
