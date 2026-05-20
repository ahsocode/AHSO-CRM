"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  MaterialCategoryItem,
  MaterialDetail,
  MaterialListItem,
  MaterialListMeta,
  MaterialSelectItem,
} from "@/lib/types";

export interface MaterialFilters {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  lowStockOnly?: boolean;
}

export interface MaterialCreateInput {
  code: string;
  name: string;
  unit: string;
  salePrice?: number;
  costPrice?: number;
  minStock?: number;
  categoryId?: string;
  description?: string;
  isActive?: boolean;
}

export interface MaterialUpdateInput extends Partial<MaterialCreateInput> {}

export interface MaterialSupplierUpsertItem {
  supplierId: string;
  supplierCode?: string;
  costPrice: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
}

export interface CategoryCreateInput {
  code: string;
  name: string;
  parentId?: string;
}

export interface CategoryUpdateInput extends Partial<CategoryCreateInput> {}

export function useMaterials(filters: MaterialFilters) {
  return useQuery({
    queryKey: ["materials", filters],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MaterialListItem[]>>("/materials", {
        params: filters,
      });
      return {
        items: res.data.data,
        meta: res.data.meta as MaterialListMeta,
      };
    },
  });
}

export function useMaterial(id?: string) {
  return useQuery({
    queryKey: ["materials", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MaterialDetail>>(`/materials/${id}`);
      return res.data.data;
    },
  });
}

export function useMaterialsSelect(search?: string) {
  return useQuery({
    queryKey: ["materials", "select", search],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MaterialSelectItem[]>>("/materials/select", {
        params: search ? { search } : {},
      });
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useMaterialCategories() {
  return useQuery({
    queryKey: ["material-categories"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MaterialCategoryItem[]>>("/material-categories");
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: MaterialCreateInput) => {
      const res = await apiClient.post<ApiResponse<MaterialDetail>>("/materials", data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateMaterial(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: MaterialUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<MaterialDetail>>(`/materials/${id}`, data);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteMaterial(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/materials/${id}`);
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpsertMaterialSuppliers(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suppliers: MaterialSupplierUpsertItem[]) => {
      const res = await apiClient.put<ApiResponse<MaterialDetail>>(
        `/materials/${id}/suppliers`,
        { suppliers }
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useCreateMaterialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CategoryCreateInput) => {
      const res = await apiClient.post<ApiResponse<MaterialCategoryItem>>(
        "/material-categories",
        data
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["material-categories"] });
    },
  });
}

export function useUpdateMaterialCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CategoryUpdateInput) => {
      const res = await apiClient.patch<ApiResponse<MaterialCategoryItem>>(
        `/material-categories/${id}`,
        data
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["material-categories"] });
    },
  });
}

export function useDeleteMaterialCategory(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
        `/material-categories/${id}`
      );
      return res.data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["material-categories"] });
    },
  });
}
