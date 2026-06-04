"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  StockDocStatus,
  StockReceiptDetail,
  StockReceiptListItem,
  StockReceiptListMeta,
} from "@/lib/types";

export interface StockReceiptFilters {
  page: number;
  limit: number;
  search?: string;
  status?: StockDocStatus;
  warehouseId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface StockReceiptLineItemInput {
  materialId: string;
  quantity: number;
  unitPrice: number;
}

export interface StockReceiptCreateInput {
  date: string;
  purchaseInvoiceNo?: string;
  warehouseId: string;
  supplierId?: string;
  notes?: string;
  items: StockReceiptLineItemInput[];
}

export interface StockReceiptUpdateInput extends Partial<Omit<StockReceiptCreateInput, "items">> {
  items?: StockReceiptLineItemInput[];
}

export function useStockReceipts(filters: StockReceiptFilters) {
  return useQuery({
    queryKey: ["stock-receipts", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockReceiptListItem[]>>("/stock-receipts", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as StockReceiptListMeta,
      };
    },
  });
}

export function useStockReceipt(id?: string) {
  return useQuery({
    queryKey: ["stock-receipts", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockReceiptDetail>>(`/stock-receipts/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateStockReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockReceiptCreateInput) => {
      const res = await apiClient.post<ApiResponse<StockReceiptDetail>>("/stock-receipts", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-receipts"] });
    },
  });
}

export function useUpdateStockReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: StockReceiptUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<StockReceiptDetail>>(
        `/stock-receipts/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-receipts"] });
    },
  });
}

export function useConfirmStockReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockReceiptDetail>>(
        `/stock-receipts/${id}/confirm`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-receipts"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useCancelStockReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<StockReceiptDetail>>(
        `/stock-receipts/${id}/cancel`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-receipts"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteStockReceipt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
        `/stock-receipts/${id}`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-receipts"] });
    },
  });
}
