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

export interface SupplierUpdateInput extends Partial<SupplierCreateInput> {}

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
    queryKey: ["suppliers", id],
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
      const res = await apiClient.post<ApiResponse<SupplierDetail>>("/suppliers", data);
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
      const res = await apiClient.patch<ApiResponse<SupplierDetail>>(`/suppliers/${id}`, data);
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
