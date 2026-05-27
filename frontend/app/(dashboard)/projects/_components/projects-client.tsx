"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { DeletedRecordsPanel } from "@/components/shared/deleted-records-panel";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/hooks/use-auth";
import { useBulkProjects, useCreateProject, useDeletedProjects, useProjectKanban, useProjects, useRestoreProject, useUpdateProjectStatus } from "@/hooks/use-projects";
import { useCustomers } from "@/hooks/use-customers";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { isLeadershipRole } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { Priority, ProjectStatus, ProjectUpsertInput, ProjectViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CsvImportDialog, CsvColumnSpec } from "@/components/shared/csv-import-dialog";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { downloadExcelRows } from "@/lib/utils";
import { ProjectFilters } from "./project-filters";
import { ProjectKanbanBoard } from "./project-kanban-board";
import { ProjectOverviewCards } from "./project-overview-cards";
import { ProjectTable } from "./project-table";

const PAGE_SIZE = 8;

const PROJECT_STATUS_VALUES = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"] as const;
const PROJECT_PRIORITY_VALUES = ["LOW", "NORMAL", "HIGH"] as const;

const getProjectViewFromUrl = (): ProjectViewMode => {
  if (typeof window === "undefined") {
    return "kanban";
  }

  return new URLSearchParams(window.location.search).get("view") === "list" ? "list" : "kanban";
};

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
  const [view, setView] = useState<ProjectViewMode>(getProjectViewFromUrl);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"status" | "delete">("status");
  const [bulkStatus, setBulkStatus] = useState<ProjectStatus>("QUOTING");
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedPage, setDeletedPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const canManageUsers = isLeadershipRole(user?.role);
  const createProject = useCreateProject();
  const bulkProjects = useBulkProjects();
  const restoreProject = useRestoreProject();
  const queryClient = useQueryClient();
  const { error: showError, success } = useToast();
  const importCustomersQuery = useCustomers({ page: 1, limit: 200 });
  const customerLookup = importCustomersQuery.data?.items ?? [];

  useEffect(() => {
    const syncViewFromUrl = () => setView(getProjectViewFromUrl());
    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);

    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, []);

  const handleViewChange = (nextView: ProjectViewMode) => {
    setView(nextView);

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("view", nextView);
    window.history.replaceState(null, "", `${nextUrl.pathname}?${nextUrl.searchParams.toString()}`);
  };

  useEffect(() => {
    setPage(1);
  }, [assignedToId, deferredSearch, priority, status, view]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, assignedToId, deferredSearch, priority, status, view]);

  useEffect(() => {
    setDeletedPage(1);
  }, [assignedToId, deferredSearch, priority, status]);

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
  const deletedProjectsQuery = useDeletedProjects(
    {
      page: deletedPage,
      limit: PAGE_SIZE,
      search: deferredSearch || undefined,
      status: status || undefined,
      priority: priority || undefined,
      assignedToId: assignedToId || undefined
    },
    showDeleted
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
  const visibleIds = projectsQuery.data?.items.map((project) => project.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

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
        eyebrow="Project Pipeline"
        title="Pipeline Dự án"
        description="Điều phối cơ hội từ khảo sát, báo giá, đàm phán đến triển khai với kanban kéo thả và dữ liệu đồng bộ."
        action={
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle: visible on all screens */}
            <div className="inline-flex rounded-md border border-border bg-white p-1">
              {(["kanban", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-semibold transition md:px-4 md:py-2",
                    view === mode
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                  )}
                  onClick={() => handleViewChange(mode)}
                  type="button"
                >
                  {mode === "kanban" ? "Kanban" : "Danh sách"}
                </button>
              ))}
            </div>
            {/* Primary CTA: always visible */}
            <Link href="/projects/new" className={cn(buttonVariants({ variant: "primary" }))}>
              Tạo dự án
            </Link>
            {/* Desktop-only power actions */}
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)} className="hidden md:inline-flex">
              Import CSV
            </Button>
            <Button type="button" variant={showDeleted ? "primary" : "outline"} onClick={() => setShowDeleted((value) => !value)} className="hidden md:inline-flex">
              {showDeleted ? "Ẩn thùng rác" : "Thùng rác"}
            </Button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "hidden md:inline-flex")}>
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

      {showDeleted ? (
        <DeletedRecordsPanel
          title="Dự án đã xóa mềm"
          description="Dự án bị xóa mềm được giữ lại để phục hồi hồ sơ 360, timeline và tài liệu liên quan khi cần."
          emptyTitle="Thùng rác dự án đang trống"
          emptyDescription="Khi xóa mềm dự án, hồ sơ sẽ xuất hiện ở đây để khôi phục."
          items={deletedProjectsQuery.data?.items ?? []}
          isLoading={deletedProjectsQuery.isLoading}
          isError={deletedProjectsQuery.isError}
          errorMessage={getApiErrorMessage(deletedProjectsQuery.error, "Không thể tải dự án đã xóa.")}
          isRestoring={restoreProject.isPending}
          page={deletedProjectsQuery.data?.meta?.page}
          totalPages={deletedProjectsQuery.data?.meta?.totalPages}
          total={deletedProjectsQuery.data?.meta?.total}
          onPageChange={setDeletedPage}
          getTitle={(project) => project.name}
          getSubtitle={(project) => `${project.code} · ${project.customer.name}`}
          getMeta={(project) => `Trạng thái trước khi xóa: ${project.status}`}
          onRestore={(id) =>
            restoreProject.mutate(id, {
              onSuccess: () => success("Đã khôi phục dự án."),
              onError: (error) => showError(error instanceof Error ? error.message : "Không thể khôi phục dự án.")
            })
          }
        />
      ) : null}

      {view === "list" && selectedIds.length > 0 ? (
        <BulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
          <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "status" | "delete")}>
            <option value="status">Đổi trạng thái</option>
            <option value="delete">Xóa mềm</option>
          </Select>

          {bulkAction === "status" ? (
            <Select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as ProjectStatus)}>
              {PROJECT_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={bulkProjects.isPending}
            onClick={() => {
              if (bulkAction === "delete" && !window.confirm(`Xóa mềm ${selectedIds.length} dự án đã chọn?`)) {
                return;
              }

              bulkProjects.mutate(
                {
                  action: bulkAction,
                  ids: selectedIds,
                  status: bulkAction === "status" ? bulkStatus : undefined
                },
	                {
	                  onSuccess: (data) => {
	                    const processedCount = data.processedCount ?? 0;
	                    const failedCount = data.failedCount ?? 0;
	                    setSelectedIds([]);
	                    if (failedCount > 0) {
	                      showError(
	                        `Đã xử lý ${processedCount} dự án, ${failedCount} dự án lỗi. ${data.errors?.[0]?.message ?? ""}`.trim()
	                      );
	                      return;
	                    }
	                    success(`Đã xử lý ${processedCount || selectedIds.length} dự án.`);
	                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể thực hiện bulk action.");
                  }
                }
              );
            }}
          >
            Áp dụng
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={bulkProjects.isPending}
            onClick={() => {
              bulkProjects.mutate(
                {
                  action: "export",
                  ids: selectedIds
                },
                {
                  onSuccess: async (data) => {
                    const items = data.items ?? [];
                    if (!items.length) {
                      showError("Không có dữ liệu để export.");
                      return;
                    }
                    const csv = buildCsv(Object.keys(items[0]), items);
                    downloadCsv("projects-selected.csv", csv);
                    await downloadExcelRows("projects-selected.xlsx", items);
                    success("Đã xuất danh sách dự án đã chọn.");
                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể export dữ liệu.");
                  }
                }
              );
            }}
          >
            Export CSV + Excel
          </Button>
        </BulkActionsBar>
      ) : null}

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
          allVisibleSelected={allVisibleSelected}
          errorMessage={getApiErrorMessage(activeError, "Không thể tải danh sách dự án.")}
          isError={projectsQuery.isError}
          isLoading={projectsQuery.isLoading}
          items={projectsQuery.data?.items ?? []}
          meta={projectsQuery.data?.meta}
          onPageChange={setPage}
          onToggleSelect={(id) =>
            setSelectedIds((current) =>
              current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
            )
          }
          onToggleSelectAll={() =>
            setSelectedIds((current) =>
              allVisibleSelected
                ? current.filter((id) => !visibleIds.includes(id))
                : [...new Set([...current, ...visibleIds])]
            )
          }
          selectedIds={selectedIds}
        />
      )}
    </div>
  );
}
