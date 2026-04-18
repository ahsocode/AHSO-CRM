"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useProjectKanban, useProjects, useUpdateProjectStatus } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { Priority, ProjectStatus, ProjectViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProjectFilters } from "./project-filters";
import { ProjectKanbanBoard } from "./project-kanban-board";
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
  const [view, setView] = useState<ProjectViewMode>("kanban");
  const deferredSearch = useDeferredValue(search.trim());
  const canManageUsers = user?.role === "ADMIN" || user?.role === "MANAGER";

  useEffect(() => {
    setPage(1);
  }, [assignedToId, deferredSearch, priority, status, view]);

  const usersQuery = useUsers(canManageUsers);
  const projectsQuery = useProjects(
    {
      page,
      limit: PAGE_SIZE,
      search: deferredSearch || undefined,
      status: status || undefined,
      priority: priority || undefined,
      assignedToId: assignedToId || undefined
    },
    view === "list"
  );
  const kanbanQuery = useProjectKanban(
    {
      search: deferredSearch || undefined,
      status: status || undefined,
      priority: priority || undefined,
      assignedToId: assignedToId || undefined
    },
    view === "kanban"
  );
  const updateStatusMutation = useUpdateProjectStatus();

  const canReset =
    search.length > 0 || status.length > 0 || priority.length > 0 || assignedToId.length > 0;
  const activeMeta = view === "kanban" ? kanbanQuery.data?.meta : projectsQuery.data?.meta;
  const activeError = view === "kanban" ? kanbanQuery.error : projectsQuery.error;
  const isLoading = view === "kanban" ? kanbanQuery.isLoading : projectsQuery.isLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dự án & Pipeline"
        description="Projects module giờ chạy cả list lẫn kanban để sales và delivery cùng nhìn một pipeline, không phải đổi context giữa nhiều màn hình."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border bg-white p-1">
              {(["kanban", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-semibold transition",
                    view === mode
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  )}
                  onClick={() => setView(mode)}
                  type="button"
                >
                  {mode === "kanban" ? "Kanban" : "Danh sách"}
                </button>
              ))}
            </div>
            <Link href="/projects/new" className={cn(buttonVariants({ variant: "primary" }))}>
              Tạo dự án
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      <ProjectOverviewCards meta={activeMeta} isLoading={isLoading} />

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

      {view === "kanban" ? (
        <ProjectKanbanBoard
          columns={kanbanQuery.data?.columns ?? []}
          errorMessage={getApiErrorMessage(activeError, "Không thể tải kanban dự án.")}
          isError={kanbanQuery.isError}
          isLoading={kanbanQuery.isLoading}
          isUpdating={updateStatusMutation.isPending}
          meta={kanbanQuery.data?.meta}
          onStatusChange={(projectId, nextStatus) => {
            updateStatusMutation.mutate({
              projectId,
              payload: {
                status: nextStatus
              }
            });
          }}
          updatingProjectId={updateStatusMutation.variables?.projectId}
        />
      ) : (
        <ProjectTable
          errorMessage={getApiErrorMessage(activeError, "Không thể tải danh sách dự án.")}
          isError={projectsQuery.isError}
          isLoading={projectsQuery.isLoading}
          items={projectsQuery.data?.items ?? []}
          meta={projectsQuery.data?.meta}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
