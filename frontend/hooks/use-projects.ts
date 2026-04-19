"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  ProjectDetail,
  ProjectFilters,
  ProjectKanbanColumn,
  ProjectListItem,
  ProjectListMeta,
  ProjectStatus,
  ProjectStatusUpdateInput,
  ProjectUpsertInput
} from "@/lib/types";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";

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
    onMutate: async ({ projectId, payload }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["projects"] }),
        queryClient.cancelQueries({ queryKey: ["dashboard"] }),
        queryClient.cancelQueries({ queryKey: ["customers"] })
      ]);

      const previousKanbanQueries = queryClient.getQueriesData<{
        columns: ProjectKanbanColumn[];
        meta: ProjectListMeta;
      }>({
        queryKey: ["projects", "kanban"]
      });
      const previousListQueries = queryClient.getQueriesData<{
        items: ProjectListItem[];
        meta: ProjectListMeta;
      }>({
        queryKey: ["projects"]
      });
      const previousProjectDetail = queryClient.getQueryData<ProjectDetail>(["projects", projectId]);

      previousKanbanQueries.forEach(([queryKey, snapshot]) => {
        if (!snapshot) {
          return;
        }

        queryClient.setQueryData(queryKey, updateKanbanSnapshot(snapshot, projectId, payload.status));
      });

      previousListQueries.forEach(([queryKey, snapshot]) => {
        if (!snapshot || queryKey.at(1) === "kanban" || typeof snapshot !== "object" || !("items" in snapshot)) {
          return;
        }

        queryClient.setQueryData(queryKey, {
          ...snapshot,
          items: snapshot.items.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  status: payload.status
                }
              : item
          )
        });
      });

      if (previousProjectDetail) {
        queryClient.setQueryData<ProjectDetail>(["projects", projectId], {
          ...previousProjectDetail,
          status: payload.status
        });
      }

      return {
        previousKanbanQueries,
        previousListQueries,
        previousProjectDetail,
        projectId,
        nextStatus: payload.status
      };
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`Đã chuyển dự án sang giai đoạn ${PROJECT_STATUS_LABELS[variables.payload.status]}.`);
    },
    onError: async (error, variables, context) => {
      context?.previousKanbanQueries.forEach(([queryKey, snapshot]) => {
        queryClient.setQueryData(queryKey, snapshot);
      });
      context?.previousListQueries.forEach(([queryKey, snapshot]) => {
        queryClient.setQueryData(queryKey, snapshot);
      });

      if (context?.previousProjectDetail) {
        queryClient.setQueryData(["projects", context.projectId], context.previousProjectDetail);
      }

      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật giai đoạn dự án.",
        variant: "destructive"
      });
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

function updateKanbanSnapshot(
  snapshot: { columns: ProjectKanbanColumn[]; meta: ProjectListMeta },
  projectId: string,
  nextStatus: ProjectStatus
) {
  let movingProject: ProjectListItem | null = null;

  const columns = snapshot.columns.map((column) => {
    const remainingItems = column.items.filter((item) => {
      if (item.id === projectId) {
        movingProject = {
          ...item,
          status: nextStatus
        };
        return false;
      }

      return true;
    });

    return {
      ...column,
      itemCount: remainingItems.length,
      totalValue: remainingItems.reduce((totalValue, item) => totalValue + item.estimatedValue, 0),
      items: remainingItems
    };
  });

  if (!movingProject) {
    return snapshot;
  }

  return {
    ...snapshot,
    columns: columns.map((column) => {
      if (column.key !== nextStatus) {
        return column;
      }

      const nextItems = [movingProject!, ...column.items];
      return {
        ...column,
        itemCount: nextItems.length,
        totalValue: nextItems.reduce((totalValue, item) => totalValue + item.estimatedValue, 0),
        items: nextItems
      };
    })
  };
}
