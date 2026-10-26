"use client";

import { useQuery } from "@tanstack/react-query";
import { forwardRef, useMemo, useState } from "react";
import { useProject } from "@/hooks/use-projects";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { ApiResponse, ProjectListItem, ProjectListMeta } from "@/lib/types";
import { EntityCombobox, type EntityComboboxProps } from "./entity-combobox";

type Props = Omit<EntityComboboxProps, "options" | "selectedOption" | "onSearchChange" | "isLoading" | "selectedLoading" | "errorMessage" | "selectedErrorMessage"> & {
  customerId?: string;
  excludeContracted?: boolean;
};

export const ProjectCombobox = forwardRef<HTMLInputElement, Props>(function ProjectCombobox({ customerId, excludeContracted = false, ...props }, ref) {
  const [search, setSearch] = useState("");
  const projects = useQuery({
    queryKey: ["projects", "combobox", search, customerId ?? "", excludeContracted],
    enabled: !props.disabled && !props.readOnly,
    queryFn: async ({ signal }) => {
      const items: ProjectListItem[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await apiClient.get<ApiResponse<ProjectListItem[]>>("/projects", {
          signal,
          params: { page, limit: 20, search: search || undefined, customerId: customerId || undefined, view: "list" }
        });
        items.push(...response.data.data.filter((project) => !excludeContracted || !project.contract));
        totalPages = (response.data.meta as ProjectListMeta).totalPages;
        page += 1;
      } while (excludeContracted && items.length < 20 && page <= totalPages);
      return items.slice(0, 20);
    }
  });
  const detail = useProject(props.value ?? "");
  const options = useMemo(() => (projects.data ?? []).map((project) => ({ id: project.id, label: project.name, description: `${project.code} · ${project.customer.name}` })), [projects.data]);
  const selected = detail.data ? { id: detail.data.id, label: detail.data.name, description: `${detail.data.code} · ${detail.data.customer.name}` } : null;
  return <EntityCombobox {...props} ref={ref} clearLabel={props.clearLabel ?? "Xóa dự án đã chọn"} options={options} selectedOption={selected} onSearchChange={setSearch} isLoading={projects.isFetching} selectedLoading={detail.isLoading} errorMessage={projects.isError ? getApiErrorMessage(projects.error, "Không thể tải dự án.") : null} selectedErrorMessage={detail.isError ? getApiErrorMessage(detail.error, "Không thể tải dự án đã chọn.") : null} />;
});
