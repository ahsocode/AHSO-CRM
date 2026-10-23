"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ProjectMaterialAllocation } from "@/lib/types";
import type {
  AllocationCostSheet,
  AllocationSuggestInput,
  AllocationSuggestResult,
  CostGroup,
  MaterialAllocationInput,
  ProjectCost,
  ProjectCostInput,
  ProjectCostSummary,
  ProjectCostUpdateInput
} from "@/types/bom";

// ─── Direct project costs (GĐ2) ───────────────────────────────────────────────

export function useProjectCosts(projectId: string, group?: CostGroup) {
  return useQuery({
    queryKey: ["projects", projectId, "costs", group ?? "all"],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectCost[]>>(`/projects/${projectId}/costs`, {
        params: group ? { group } : undefined
      });
      return response.data.data;
    }
  });
}

function useInvalidateProjectFinance(projectId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "costs"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "cost-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "material-allocations"] });
    await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "material-allocation"] });
    await queryClient.invalidateQueries({ queryKey: ["material-allocations"] });
  };
}

export function useCreateProjectCost(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  return useMutation({
    mutationFn: async (payload: ProjectCostInput) => {
      const response = await apiClient.post<ApiResponse<ProjectCost>>(`/projects/${projectId}/costs`, payload);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useUpdateProjectCost(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  return useMutation({
    mutationFn: async ({ costId, data }: { costId: string; data: ProjectCostUpdateInput }) => {
      const response = await apiClient.patch<ApiResponse<ProjectCost>>(`/project-costs/${costId}`, data);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useDeleteProjectCost(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  return useMutation({
    mutationFn: async (costId: string) => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(`/project-costs/${costId}`);
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

// ─── Allocations: one per sales invoice (GĐ2) ─────────────────────────────────

export function useProjectMaterialAllocations(projectId: string, includeCancelled = false) {
  return useQuery({
    queryKey: ["projects", projectId, "material-allocations", includeCancelled],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectMaterialAllocation[]>>(
        `/projects/${projectId}/material-allocations`,
        { params: includeCancelled ? { includeCancelled: true } : undefined }
      );
      return response.data.data;
    }
  });
}

export function useMaterialAllocation(allocationId?: string) {
  return useQuery({
    queryKey: ["material-allocations", allocationId],
    enabled: Boolean(allocationId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectMaterialAllocation>>(
        `/material-allocations/${allocationId}`
      );
      return response.data.data;
    }
  });
}

export function useCreateMaterialAllocation(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  return useMutation({
    mutationFn: async (payload: MaterialAllocationInput) => {
      const response = await apiClient.post<ApiResponse<ProjectMaterialAllocation>>(
        `/projects/${projectId}/material-allocations`,
        payload
      );
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useUpdateMaterialAllocation(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  return useMutation({
    mutationFn: async ({ allocationId, data }: { allocationId: string; data: MaterialAllocationInput }) => {
      const response = await apiClient.put<ApiResponse<ProjectMaterialAllocation>>(
        `/material-allocations/${allocationId}`,
        data
      );
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

export function useConfirmMaterialAllocation(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocationId: string) => {
      const response = await apiClient.post<ApiResponse<ProjectMaterialAllocation>>(
        `/material-allocations/${allocationId}/confirm`
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "eligible-stock-lots"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-issues"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
    }
  });
}

/** Only DRAFT allocations can be cancelled (confirmed ones have already issued stock). */
export function useCancelMaterialAllocation(projectId: string) {
  const invalidate = useInvalidateProjectFinance(projectId);
  return useMutation({
    mutationFn: async (allocationId: string) => {
      const response = await apiClient.post<ApiResponse<ProjectMaterialAllocation>>(
        `/material-allocations/${allocationId}/cancel`
      );
      return response.data.data;
    },
    onSuccess: invalidate
  });
}

/** FIFO suggestion from a BOM (does not write anything). Call `mutate`/`mutateAsync` with the form values. */
export function useSuggestMaterialAllocation(projectId: string) {
  return useMutation({
    mutationFn: async (payload: AllocationSuggestInput) => {
      const response = await apiClient.post<ApiResponse<AllocationSuggestResult>>(
        `/projects/${projectId}/material-allocations/suggest`,
        payload
      );
      return response.data.data;
    }
  });
}

// ─── Reports (GĐ3) ────────────────────────────────────────────────────────────

export function useProjectCostSummary(projectId: string, bomId?: string) {
  return useQuery({
    queryKey: ["projects", projectId, "cost-summary", bomId ?? "default"],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectCostSummary>>(`/projects/${projectId}/cost-summary`, {
        params: bomId ? { bomId } : undefined
      });
      return response.data.data;
    }
  });
}

/** Data for "Bảng kê giá vốn hóa đơn bán số …"; the page exports it to Excel with exceljs. */
export function useAllocationCostSheet(allocationId?: string, enabled = true) {
  return useQuery({
    queryKey: ["material-allocations", allocationId, "cost-sheet"],
    enabled: Boolean(allocationId) && enabled,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AllocationCostSheet>>(
        `/material-allocations/${allocationId}/cost-sheet`
      );
      return response.data.data;
    }
  });
}
