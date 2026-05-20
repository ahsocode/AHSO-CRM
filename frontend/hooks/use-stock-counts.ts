"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  StockCountDetail,
  StockCountListItem,
  StockCountListMeta,
  StockDocStatus,
} from "@/lib/types";

export interface StockCountFilters {
  page: number;
  limit: number;
  search?: string;
  status?: StockDocStatus;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockCountLineItemInput {
  materialId: string;
  actualQuantity: number;
}

export interface StockCountCreateInput {
  date: string;
  warehouseId: string;
  notes?: string;
  items: StockCountLineItemInput[];
}

export interface StockCountUpdateInput extends Partial<Omit<StockCountCreateInput, "items">> {
  items?: StockCountLineItemInput[];
}

export function useStockCounts(filters: StockCountFilters) {
  return useQuery({
    queryKey: ["stock-counts", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockCountListItem[]>>("/stock-counts", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as StockCountListMeta,
      };
    },
  });
}

export function useStockCount(id?: string) {
  return useQuery({
    queryKey: ["stock-counts", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockCountDetail>>(`/stock-counts/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockCountCreateInput) => {
      const res = await apiClient.post<ApiResponse<StockCountDetail>>("/stock-counts", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-counts"] });
    },
  });
}

export function useUpdateStockCount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockCountUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<StockCountDetail>>(
        `/stock-counts/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-counts"] });
    },
  });
}

export function useConfirmStockCount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockCountDetail>>(
        `/stock-counts/${id}/confirm`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-counts"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCancelStockCount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockCountDetail>>(
        `/stock-counts/${id}/cancel`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-counts"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteStockCount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
        `/stock-counts/${id}`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-counts"] });
    },
  });
}
