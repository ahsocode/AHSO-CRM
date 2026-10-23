"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/types";
import type {
  BomCreateInput,
  BomCreatedResult,
  BomDetail,
  BomLineInput,
  BomListItem,
  BomModelFilters,
  BomSaveAsModelInput,
  BomUpdateInput
} from "@/types/bom";

// Query keys: ["boms", "project", projectId] · ["boms", "models", filters] · ["boms", "models", "versions", productId] · ["boms", bomId]

export function useProjectBoms(projectId: string) {
  return useQuery({
    queryKey: ["boms", "project", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<BomListItem[]>>(`/projects/${projectId}/boms`);
      return response.data.data;
    }
  });
}

export function useBom(bomId?: string) {
  return useQuery({
    queryKey: ["boms", bomId],
    enabled: Boolean(bomId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<BomDetail>>(`/boms/${bomId}`);
      return response.data.data;
    }
  });
}

/** Mẫu máy (MODEL BOMs) — used by "Tạo từ mẫu" and the sub-assembly picker. */
export function useBomModels(filters: BomModelFilters = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["boms", "models", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<BomListItem[]>>("/boms/models", { params: filters });
      return response.data.data;
    }
  });
}

export function useBomModelVersions(productId?: string) {
  return useQuery({
    queryKey: ["boms", "models", "versions", productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<BomListItem[]>>(`/boms/models/${productId}/versions`);
      return response.data.data;
    }
  });
}

function useInvalidateBoms() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["boms"] });
    // Quote cost estimates and project cost reports depend on BOM totals
    await queryClient.invalidateQueries({ queryKey: ["quotes"] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };
}

export function useCreateProjectBom(projectId: string) {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (payload: BomCreateInput) => {
      const response = await apiClient.post<ApiResponse<BomCreatedResult>>(`/projects/${projectId}/boms`, payload);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useUpdateBom(bomId: string) {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (payload: BomUpdateInput) => {
      const response = await apiClient.patch<ApiResponse<BomDetail>>(`/boms/${bomId}`, payload);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

/** Replaces every line of a DRAFT BOM; keep `id` on existing lines so allocations / costs stay linked. */
export function useReplaceBomLines(bomId: string) {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (lines: BomLineInput[]) => {
      const response = await apiClient.put<ApiResponse<BomDetail>>(`/boms/${bomId}/lines`, { lines });
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useApproveBom() {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (bomId: string) => {
      const response = await apiClient.post<ApiResponse<BomDetail>>(`/boms/${bomId}/approve`);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

/** Copies an APPROVED BOM into a new DRAFT version (R4). Resolves with the new BOM id/code/version. */
export function useCreateBomVersion() {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (bomId: string) => {
      const response = await apiClient.post<ApiResponse<BomCreatedResult>>(`/boms/${bomId}/new-version`);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useArchiveBom() {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (bomId: string) => {
      const response = await apiClient.post<ApiResponse<BomDetail>>(`/boms/${bomId}/archive`);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useDeleteBom() {
  const invalidate = useInvalidateBoms();
  return useMutation({
    mutationFn: async (bomId: string) => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/boms/${bomId}`);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

/** "Lưu thành mẫu máy" — creates a MODEL DRAFT (next version of the product). */
export function useSaveBomAsModel(bomId: string) {
  const invalidate = useInvalidateBoms();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BomSaveAsModelInput) => {
      const response = await apiClient.post<ApiResponse<BomCreatedResult>>(`/boms/${bomId}/save-as-model`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  });
}
