"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  WarehouseListItem,
  WarehouseSelectItem,
} from "@/lib/types";

export interface WarehouseFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface WarehouseListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WarehouseCreateInput {
  code: string;
  name: string;
  address?: string;
  managerId?: string;
  isActive?: boolean;
}

export interface WarehouseUpdateInput extends Partial<WarehouseCreateInput> {}

export function useWarehouses(filters?: WarehouseFilters) {
  return useQuery({
    queryKey: ["warehouses", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WarehouseListItem[]>>("/warehouses", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as WarehouseListMeta,
      };
    },
  });
}

export function useWarehouse(id?: string) {
  return useQuery({
    queryKey: ["warehouses", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WarehouseListItem>>(`/warehouses/${id}`);
      return res.data.data;
    },
  });
}

export function useWarehousesSelect() {
  return useQuery({
    queryKey: ["warehouses", "select"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WarehouseSelectItem[]>>("/warehouses/select");
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: WarehouseCreateInput) => {
      const res = await apiClient.post<ApiResponse<WarehouseListItem>>("/warehouses", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["warehouses"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateWarehouse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: WarehouseUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<WarehouseListItem>>(`/warehouses/${id}`, data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["warehouses"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteWarehouse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/warehouses/${id}`);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["warehouses"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
