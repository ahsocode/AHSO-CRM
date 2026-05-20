"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  StockDocStatus,
  StockIssueDetail,
  StockIssueListItem,
  StockIssueListMeta,
} from "@/lib/types";

export interface StockIssueFilters {
  page: number;
  limit: number;
  search?: string;
  status?: StockDocStatus;
  warehouseId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockIssueLineItemInput {
  materialId: string;
  quantity: number;
  unitPrice: number;
}

export interface StockIssueCreateInput {
  date: string;
  warehouseId: string;
  projectId?: string;
  reason?: string;
  notes?: string;
  items: StockIssueLineItemInput[];
}

export interface StockIssueUpdateInput extends Partial<Omit<StockIssueCreateInput, "items">> {
  items?: StockIssueLineItemInput[];
}

export function useStockIssues(filters: StockIssueFilters) {
  return useQuery({
    queryKey: ["stock-issues", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockIssueListItem[]>>("/stock-issues", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as StockIssueListMeta,
      };
    },
  });
}

export function useStockIssue(id?: string) {
  return useQuery({
    queryKey: ["stock-issues", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockIssueDetail>>(`/stock-issues/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateStockIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockIssueCreateInput) => {
      const res = await apiClient.post<ApiResponse<StockIssueDetail>>("/stock-issues", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-issues"] });
    },
  });
}

export function useUpdateStockIssue(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockIssueUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<StockIssueDetail>>(
        `/stock-issues/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-issues"] });
    },
  });
}

export function useConfirmStockIssue(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockIssueDetail>>(
        `/stock-issues/${id}/confirm`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-issues"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      await qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useCancelStockIssue(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockIssueDetail>>(
        `/stock-issues/${id}/cancel`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-issues"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteStockIssue(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
        `/stock-issues/${id}`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-issues"] });
    },
  });
}
