"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useCreateProject, useProjectKanban, useProjects, useUpdateProjectStatus } from "@/hooks/use-projects";
import { useCustomers } from "@/hooks/use-customers";
import { useUsers } from "@/hooks/use-users";
import { isLeadershipRole } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { Priority, ProjectStatus, ProjectUpsertInput, ProjectViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CsvImportDialog, CsvColumnSpec } from "@/components/shared/csv-import-dialog";
import { ProjectFilters } from "./project-filters";
import { ProjectKanbanBoard } from "./project-kanban-board";
import { ProjectOverviewCards } from "./project-overview-cards";
import { ProjectTable } from "./project-table";

const PAGE_SIZE = 8;

const PROJECT_STATUS_VALUES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"] as const;
const PROJECT_PRIORITY_VALUES = ["LOW", "NORMAL", "HIGH"] as const;

const parseNumberVND = (value: string): number | undefined => {
  const cleaned = value.replace(/[.,\s]/g, "").replace(/[đ₫vnđ]/gi, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Giá trị không hợp lệ: "${value}"`);
  return n;
};

const parseDateYMD = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Ngày không hợp lệ: "${value}" (dùng YYYY-MM-DD)`);
  }
  return date.toISOString();
};

export function ProjectsClient() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [assignedToId, setAssignedToId] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ProjectViewMode>("kanban");
  const [importOpen, setImportOpen] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const canManageUsers = isLeadershipRole(user?.role);
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const importCustomersQuery = useCustomers({ page: 1, limit: 200 });
  const customerLookup = importCustomersQuery.data?.items ?? [];

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

  const findCustomerId = (taxCode: string, name: string): string | undefined => {
    if (taxCode) {
      const byTax = customerLookup.find(
        (c) => c.taxCode?.toLowerCase() === taxCode.trim().toLowerCase()
      );
      if (byTax) return byTax.id;
    }
    if (name) {
      const byName = customerLookup.find(
        (c) => c.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (byName) return byName.id;
    }
    return undefined;
  };

  const importColumns: CsvColumnSpec<ProjectUpsertInput>[] = [
    {
      // Informational column - actual resolution happens in next column. Transform is no-op.
      header: "Mã số thuế KH",
      key: "customerId",
      example: "0300588569",
      transform: () => undefined
    },
    {
      header: "Tên khách hàng *",
      key: "customerId",
      required: true,
      example: "Công ty Vinamilk",
      transform: (value, row) => {
        const taxCode = row["Mã số thuế KH"] ?? "";
        const id = findCustomerId(taxCode, value);
        if (!id) {
          throw new Error(
            `Không tìm thấy KH (MST: "${taxCode}", Tên: "${value}"). KH phải tồn tại sẵn.`
          );
        }
        return id;
      }
    },
    {
      header: "Tên dự án *",
      key: "name",
      required: true,
      example: "Dây chuyền sữa chua tự động",
      transform: (v) => {
        if (!v) throw new Error("Thiếu tên dự án");
        return v;
      }
    },
    { header: "Mô tả", key: "description", example: "Đóng gói 120k hũ/ca", transform: (v) => v || undefined },
    {
      header: "Trạng thái",
      key: "status",
      example: "SURVEY",
      transform: (v) => {
        if (!v) return "SURVEY" as ProjectStatus;
        const upper = v.trim().toUpperCase() as ProjectStatus;
        if (!PROJECT_STATUS_VALUES.includes(upper as typeof PROJECT_STATUS_VALUES[number])) {
          throw new Error(
            `Trạng thái "${v}" không hợp lệ (${PROJECT_STATUS_VALUES.join("/")})`
          );
        }
        return upper;
      }
    },
    {
      header: "Mức độ ưu tiên",
      key: "priority",
      example: "NORMAL",
      transform: (v) => {
        if (!v) return "NORMAL" as Priority;
        const upper = v.trim().toUpperCase() as Priority;
        if (!PROJECT_PRIORITY_VALUES.includes(upper as typeof PROJECT_PRIORITY_VALUES[number])) {
          throw new Error(`Độ ưu tiên "${v}" không hợp lệ (LOW/NORMAL/HIGH)`);
        }
        return upper;
      }
    },
    {
      header: "Giá trị dự kiến (VNĐ)",
      key: "estimatedValue",
      example: "1200000000",
      transform: (v) => parseNumberVND(v)
    },
    {
      header: "Ngày bắt đầu (YYYY-MM-DD)",
      key: "startDate",
      example: "2026-05-01",
      transform: (v) => parseDateYMD(v)
    },
    {
      header: "Ngày kết thúc dự kiến (YYYY-MM-DD)",
      key: "expectedEndDate",
      example: "2026-09-30",
      transform: (v) => parseDateYMD(v)
    },
    { header: "Ghi chú", key: "notes", example: "", transform: (v) => v || undefined }
  ];

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
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      <CsvImportDialog<ProjectUpsertInput>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import danh sách dự án từ CSV"
        description="Khách hàng phải tồn tại trước. Dùng Mã số thuế hoặc Tên KH để tra cứu."
        templateFilename="du-an-mau.csv"
        columns={importColumns}
        submitRow={async (input) => {
          const result = await createProject.mutateAsync(input);
          return { displayName: `${input.name}${result?.code ? ` (${result.code})` : ""}` };
        }}
        onFinish={() => {
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
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
