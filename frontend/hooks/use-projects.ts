"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  ProjectDetail,
  ProjectFilters,
  ProjectKanbanColumn,
  ProjectListItem,
  ProjectListMeta,
  ProjectStatusUpdateInput,
  ProjectUpsertInput
} from "@/lib/types";

export function useProjects(filters: ProjectFilters, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["projects", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectListItem[]>>("/projects", {
        params: {
          ...filters,
          view: "list"
        }
      });

      return {
        items: response.data.data,
        meta: response.data.meta as ProjectListMeta
      };
    }
  });
}

export function useProjectKanban(filters: Omit<ProjectFilters, "page" | "limit">, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["projects", "kanban", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectKanbanColumn[]>>("/projects", {
        params: {
          ...filters,
          page: 1,
          limit: 100,
          view: "kanban"
        }
      });

      return {
        columns: response.data.data,
        meta: response.data.meta as ProjectListMeta
      };
    }
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectDetail>>(`/projects/${projectId}`);
      return response.data.data;
    }
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProjectUpsertInput) => {
      const response = await apiClient.post<ApiResponse<{ id: string; code: string }>>("/projects", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<ProjectUpsertInput>) => {
      const response = await apiClient.patch<ApiResponse<{ id: string }>>(`/projects/${projectId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      payload
    }: {
      projectId: string;
      payload: ProjectStatusUpdateInput;
    }) => {
      const response = await apiClient.patch<ApiResponse<{ id: string; status: string }>>(
        `/projects/${projectId}/status`,
        payload
      );
      return response.data.data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/projects/${projectId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}
