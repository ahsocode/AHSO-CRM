"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse, InventoryBalanceItem, InventorySummary } from "@/lib/types";

export interface InventoryBalanceFilters {
  page?: number;
  limit?: number;
  warehouseId?: string;
  materialId?: string;
  lowStockOnly?: boolean;
}

export interface InventoryBalanceListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useInventoryBalances(filters: InventoryBalanceFilters) {
  return useQuery({
    queryKey: ["inventory", "balances", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InventoryBalanceItem[]>>("/inventory/balances", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as InventoryBalanceListMeta,
      };
    },
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InventorySummary>>("/inventory/summary");
      return res.data.data;
    },
    staleTime: 60_000,
  });
}
