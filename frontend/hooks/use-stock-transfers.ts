"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  StockDocStatus,
  StockTransferDetail,
  StockTransferListItem,
  StockTransferListMeta,
} from "@/lib/types";

export interface StockTransferFilters {
  page: number;
  limit: number;
  search?: string;
  status?: StockDocStatus;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockTransferLineItemInput {
  materialId: string;
  quantity: number;
}

export interface StockTransferCreateInput {
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  items: StockTransferLineItemInput[];
}

export interface StockTransferUpdateInput extends Partial<Omit<StockTransferCreateInput, "items">> {
  items?: StockTransferLineItemInput[];
}

export function useStockTransfers(filters: StockTransferFilters) {
  return useQuery({
    queryKey: ["stock-transfers", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockTransferListItem[]>>("/stock-transfers", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as StockTransferListMeta,
      };
    },
  });
}

export function useStockTransfer(id?: string) {
  return useQuery({
    queryKey: ["stock-transfers", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockTransferDetail>>(`/stock-transfers/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockTransferCreateInput) => {
      const res = await apiClient.post<ApiResponse<StockTransferDetail>>("/stock-transfers", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
  });
}

export function useUpdateStockTransfer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockTransferUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<StockTransferDetail>>(
        `/stock-transfers/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
  });
}

export function useConfirmStockTransfer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockTransferDetail>>(
        `/stock-transfers/${id}/confirm`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCancelStockTransfer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockTransferDetail>>(
        `/stock-transfers/${id}/cancel`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteStockTransfer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
        `/stock-transfers/${id}`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
  });
}
