import Link from "next/link";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PRIORITY_LABELS } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { ProjectListItem, ProjectListMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG = {
  LOW: { label: PRIORITY_LABELS.LOW, variant: "neutral" as const },
  NORMAL: { label: PRIORITY_LABELS.NORMAL, variant: "info" as const },
  HIGH: { label: PRIORITY_LABELS.HIGH, variant: "warning" as const }
};

const CONTRACT_STATUS_CONFIG = {
  ACTIVE: { label: "Hiệu lực", variant: "info" as const },
  SUSPENDED: { label: "Tạm dừng", variant: "warning" as const },
  COMPLETED: { label: "Hoàn tất", variant: "success" as const },
  CANCELLED: { label: "Hủy", variant: "danger" as const }
};

const PROGRESS_COLOR = (pct: number) => {
  if (pct >= 85) return "bg-success";
  if (pct >= 50) return "bg-primary";
  if (pct >= 20) return "bg-accent";
  return "bg-slate-400";
};

export function ProjectTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
  selectedIds,
  allVisibleSelected,
  onToggleSelect,
  onToggleSelectAll
}: {
  items: ProjectListItem[];
  meta?: ProjectListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
  selectedIds: string[];
  allVisibleSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách dự án</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader><CardTitle>Danh sách dự án</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách dự án."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader><CardTitle>Danh sách dự án</CardTitle></CardHeader>
        <CardContent>
          <EmptyState
            title="Không có dự án phù hợp"
            description="Nới bộ lọc hiện tại hoặc thêm dữ liệu mới để tiếp tục kiểm tra luồng pipeline."
          />
        </CardContent>
      </Card>
    );
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <Card className="border border-white/70">
      <CardHeader className="gap-2 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Project Ledger</p>
          <CardTitle>Danh sách dự án</CardTitle>
          <p className="mt-1 text-sm text-text-secondary">
            {meta?.total ?? items.length} dự án · trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline" size="sm">
            <AppIcon name="chevron-left" className="mr-1 text-base" />
            Trước
          </Button>
          <span className="min-w-[3rem] text-center text-sm font-medium text-text-secondary">
            {currentPage} / {totalPages}
          </span>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline" size="sm">
            Tiếp
            <AppIcon name="chevron-right" className="ml-1 text-base" />
          </Button>
        </div>
      </CardHeader>

      {/* Mobile cards */}
      <CardContent className="md:hidden space-y-2">
        {items.map((project) => (
          <article key={project.id} className="rounded-xl border border-border/60 bg-white/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <Checkbox
                  checked={selectedIds.includes(project.id)}
                  onCheckedChange={() => onToggleSelect(project.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <Link href={`/projects/${project.id}`} className="block truncate font-semibold text-text-primary hover:text-primary">
                    {project.name}
                  </Link>
                  <p className="text-xs text-text-secondary">{project.code}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <StatusBadge kind="project" status={project.status} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-text-primary">
                <CurrencyDisplay amount={project.estimatedValue} short />
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                    <div className={cn("h-full rounded-full", PROGRESS_COLOR(project.progressPercent))} style={{ width: `${project.progressPercent}%` }} />
                  </div>
                  <span className="text-xs font-medium text-text-secondary">{project.progressPercent}%</span>
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">{project.customer.name}</span>
              <div className="flex gap-1">
                <Link href={`/projects/${project.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Chi tiết</Button>
                </Link>
                <Link href={`/projects/${project.id}/edit`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Sửa</Button>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </CardContent>

      {/* Desktop compact table */}
      <CardContent className="hidden md:block p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border/50 bg-bg-subtle/60">
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={onToggleSelectAll} />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Dự án
                </th>
                <th className="w-44 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Khách hàng
                </th>
                <th className="w-36 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Giá trị
                </th>
                <th className="w-48 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  Tiến độ
                </th>
                <th className="w-16 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((project) => {
                const isSelected = selectedIds.includes(project.id);
                return (
                  <tr
                    key={project.id}
                    className={cn(
                      "group transition-colors hover:bg-primary-bg/30",
                      isSelected && "bg-primary-bg/20"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-4 py-3 align-middle">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(project.id)}
                      />
                    </td>

                    {/* Dự án */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-semibold text-text-primary hover:text-primary line-clamp-1 max-w-[280px]"
                        >
                          {project.name}
                        </Link>
                        <StatusBadge kind="project" status={project.status} />
                        <Badge variant={PRIORITY_CONFIG[project.priority].variant} className="text-[10px] px-1.5 py-0">
                          {PRIORITY_CONFIG[project.priority].label}
                        </Badge>
                        {project.isOverdue ? (
                          <Badge variant="danger" className="text-[10px] px-1.5 py-0">Trễ hạn</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {project.code}
                        {project.description ? (
                          <span className="ml-1.5 text-text-secondary line-clamp-1">
                            · {project.description}
                          </span>
                        ) : null}
                      </p>
                    </td>

                    {/* Khách hàng */}
                    <td className="w-44 px-3 py-3 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarInitials
                          name={project.customer.assignedTo.name}
                          className="h-7 w-7 shrink-0 rounded-full text-[10px]"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/customers/${project.customer.id}`}
                            className="block truncate text-sm font-medium text-text-primary hover:text-primary"
                          >
                            {project.customer.name}
                          </Link>
                          <p className="truncate text-xs text-text-muted">
                            {project.customer.industry ?? "Chưa phân ngành"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Giá trị */}
                    <td className="w-36 px-3 py-3 align-middle">
                      <p className="text-base font-bold text-text-primary tabular-nums">
                        <CurrencyDisplay amount={project.estimatedValue} short />
                      </p>
                      {project.contract ? (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs text-text-secondary max-w-[80px]">
                            {project.contract.contractNo}
                          </span>
                          <Badge variant={CONTRACT_STATUS_CONFIG[project.contract.status].variant} className="text-[10px] px-1.5 py-0 shrink-0">
                            {CONTRACT_STATUS_CONFIG[project.contract.status].label}
                          </Badge>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-xs text-text-muted">Chưa có HĐ</p>
                      )}
                    </td>

                    {/* Tiến độ */}
                    <td className="w-48 px-3 py-3 align-middle">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold tabular-nums text-text-primary">
                          {project.progressPercent}%
                        </span>
                        <span className="text-xs text-text-muted">
                          {project.expectedEndDate ? formatDate(project.expectedEndDate) : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={cn("h-full rounded-full transition-all", PROGRESS_COLOR(project.progressPercent))}
                          style={{ width: `${project.progressPercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {project.quoteCount} BG · {project.milestoneCount} MS · {project.activityCount} HĐ
                        <span className="ml-1.5">· {formatRelativeTime(project.lastActivityAt ?? project.updatedAt)}</span>
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="w-16 px-2 py-3 align-middle">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/projects/${project.id}`}>
                          <button
                            type="button"
                            title="Chi tiết"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-primary"
                          >
                            <AppIcon name="external-link" className="text-[16px]" />
                          </button>
                        </Link>
                        <Link href={`/projects/${project.id}/edit`}>
                          <button
                            type="button"
                            title="Chỉnh sửa"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-primary"
                          >
                            <AppIcon name="pencil" className="text-[16px]" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
          <p className="text-sm text-text-secondary">
            {meta?.total ?? items.length} dự án · trang {currentPage}/{totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline" size="sm">
              <AppIcon name="chevron-left" className="mr-1 text-base" />
              Trước
            </Button>
            <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline" size="sm">
              Tiếp
              <AppIcon name="chevron-right" className="ml-1 text-base" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
