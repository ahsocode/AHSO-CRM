"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, ProjectDetail, ProjectFilters, ProjectListItem, ProjectListMeta } from "@/lib/types";

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ProjectListItem[]>>("/projects", {
        params: filters
      });

      return {
        items: response.data.data,
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
