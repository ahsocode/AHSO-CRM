"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { Priority, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProjectFilters } from "./project-filters";
import { ProjectOverviewCards } from "./project-overview-cards";
import { ProjectTable } from "./project-table";

const PAGE_SIZE = 8;

export function ProjectsClient() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [assignedToId, setAssignedToId] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const canManageUsers = user?.role === "ADMIN" || user?.role === "MANAGER";

  useEffect(() => {
    setPage(1);
  }, [assignedToId, deferredSearch, priority, status]);

  const usersQuery = useUsers(canManageUsers);
  const projectsQuery = useProjects({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    status: status || undefined,
    priority: priority || undefined,
    assignedToId: assignedToId || undefined
  });

  const canReset =
    search.length > 0 || status.length > 0 || priority.length > 0 || assignedToId.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dự án & Pipeline"
        description="Danh sách dự án đã được nối dữ liệu thật để theo dõi pipeline, contract readiness và delivery status trên cùng một bề mặt."
        action={
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
            Về dashboard
          </Link>
        }
      />

      <ProjectOverviewCards meta={projectsQuery.data?.meta} isLoading={projectsQuery.isLoading} />

      <ProjectFilters
        assignedToId={assignedToId}
        canReset={canReset}
        onAssignedToIdChange={setAssignedToId}
        onPriorityChange={setPriority}
        onReset={() => {
          setSearch("");
          setStatus("");
          setPriority("");
          setAssignedToId("");
          setPage(1);
        }}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        priority={priority}
        search={search}
        status={status}
        users={usersQuery.data ?? []}
        usersUnavailable={!canManageUsers || usersQuery.isError}
      />

      <ProjectTable
        errorMessage={getApiErrorMessage(projectsQuery.error, "Không thể tải danh sách dự án.")}
        isError={projectsQuery.isError}
        isLoading={projectsQuery.isLoading}
        items={projectsQuery.data?.items ?? []}
        meta={projectsQuery.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
