"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  SupplierDetail,
  SupplierListItem,
  SupplierListMeta,
  SupplierSelectItem,
} from "@/lib/types";

export interface SupplierFilters {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export interface SupplierCreateInput {
  code: string;
  name: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactName?: string;
  notes?: string;
  isActive?: boolean;
}

/** "" hoặc null = xóa trường; bỏ qua (undefined) = giữ nguyên */
export type SupplierUpdateInput = {
  [K in keyof SupplierCreateInput]?: SupplierCreateInput[K] | null;
};

export function useSuppliers(filters: SupplierFilters) {
  return useQuery({
    queryKey: ["suppliers", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SupplierListItem[]>>("/suppliers", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as SupplierListMeta,
      };
    },
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    // Namespaced "detail" key — avoids colliding with ["suppliers", "select"]
    // and list keys; invalidating ["suppliers"] still refreshes it.
    queryKey: ["suppliers", "detail", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SupplierDetail>>(`/suppliers/${id}`);
      return res.data.data;
    },
  });
}

export function useSuppliersSelect() {
  return useQuery({
    queryKey: ["suppliers", "select"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SupplierSelectItem[]>>("/suppliers/select");
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: SupplierCreateInput) => {
      const res = await apiClient.post<ApiResponse<Pick<SupplierDetail, "id" | "code" | "name">>>("/suppliers", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

export function useUpdateSupplier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: SupplierUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<Pick<SupplierDetail, "id" | "code" | "name">>>(`/suppliers/${id}`, data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

export function useDeleteSupplier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/suppliers/${id}`);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}

/** Xuất toàn bộ NCC theo bộ lọc (endpoint riêng, không bị giới hạn limit=100) */
export async function fetchSuppliersExport(filters: Pick<SupplierFilters, "search" | "isActive">) {
  const res = await apiClient.get<ApiResponse<{ items: Record<string, string>[] }>>("/suppliers/export", {
    params: filters,
  });
  return res.data.data.items;
}
