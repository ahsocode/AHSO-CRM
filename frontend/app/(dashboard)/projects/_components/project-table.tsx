import Link from "next/link";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIORITY_LABELS } from "@/lib/constants";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { ProjectListItem, ProjectListMeta } from "@/lib/types";

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

export function ProjectTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange
}: {
  items: ProjectListItem[];
  meta?: ProjectListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách dự án</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-border/60 p-4 lg:grid-cols-[1.25fr_1fr_210px_220px]"
            >
              <LoadingSkeleton className="h-20 w-full" />
              <LoadingSkeleton className="h-20 w-full" />
              <LoadingSkeleton className="h-20 w-full" />
              <LoadingSkeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader>
          <CardTitle>Danh sách dự án</CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle>Danh sách dự án</CardTitle>
        </CardHeader>
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
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Project Ledger</p>
          <CardTitle>Danh sách dự án</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} dự án, trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline">
            Trang trước
          </Button>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline">
            Trang sau
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:hidden">
          {items.map((project) => (
            <article key={project.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/projects/${project.id}`} className="font-heading text-lg font-bold text-text-primary hover:text-primary">
                  {project.name}
                </Link>
                <StatusBadge kind="project" status={project.status} />
                <Badge variant={PRIORITY_CONFIG[project.priority].variant}>
                  {PRIORITY_CONFIG[project.priority].label}
                </Badge>
                {project.isOverdue ? <Badge variant="danger">Trễ hạn</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-text-secondary">{project.code} · {project.customer.name}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-heading text-2xl font-extrabold text-text-primary">
                  <CurrencyDisplay amount={project.estimatedValue} short />
                </span>
                <span className="text-sm text-text-secondary">{project.progressPercent}%</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href={`/projects/${project.id}`} className="contents">
                  <Button size="sm" type="button" variant="outline">
                    Chi tiết
                  </Button>
                </Link>
                <Link href={`/projects/${project.id}/edit`} className="contents">
                  <Button size="sm" type="button" variant="ghost">
                    Sửa
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4">Dự án</th>
                <th className="px-4">Khách hàng</th>
                <th className="px-4">Giá trị & HĐ</th>
                <th className="px-4">Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((project) => (
                <tr key={project.id} className="bg-white/80 shadow-sm">
                  <td className="rounded-l-2xl px-4 py-4 align-top">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/projects/${project.id}`} className="font-heading text-lg font-bold text-text-primary hover:text-primary">
                          {project.name}
                        </Link>
                        <StatusBadge kind="project" status={project.status} />
                        <Badge variant={PRIORITY_CONFIG[project.priority].variant}>
                          {PRIORITY_CONFIG[project.priority].label}
                        </Badge>
                        {project.isOverdue ? <Badge variant="danger">Trễ hạn</Badge> : null}
                      </div>
                      <div className="space-y-1 text-sm text-text-secondary">
                        <p>{project.code}</p>
                        <p>{project.description ?? "Chưa có mô tả kỹ thuật."}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <AvatarInitials name={project.customer.assignedTo.name} className="h-10 w-10 rounded-full text-xs" />
                      <div className="space-y-1 text-sm">
                        <Link href={`/customers/${project.customer.id}`} className="font-semibold text-text-primary hover:text-primary">
                          {project.customer.name}
                        </Link>
                        <p className="text-text-secondary">{project.customer.industry ?? "Chưa phân ngành"}</p>
                        <p className="text-text-secondary">Owner: {project.customer.assignedTo.name}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 text-sm">
                      <p className="font-heading text-2xl font-extrabold text-text-primary">
                        <CurrencyDisplay amount={project.estimatedValue} short />
                      </p>
                      {project.contract ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-text-primary">{project.contract.contractNo}</span>
                            <Badge variant={CONTRACT_STATUS_CONFIG[project.contract.status].variant}>
                              {CONTRACT_STATUS_CONFIG[project.contract.status].label}
                            </Badge>
                          </div>
                          <p className="text-text-secondary">
                            <CurrencyDisplay amount={project.contract.value} short />
                          </p>
                        </div>
                      ) : (
                        <p className="text-text-secondary">Chưa có hợp đồng</p>
                      )}
                    </div>
                  </td>

                  <td className="rounded-r-2xl px-4 py-4 align-top">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text-primary">{project.progressPercent}%</span>
                        <span className="text-text-secondary">
                          {project.expectedEndDate ? formatDate(project.expectedEndDate) : "Chưa có hạn"}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
                      </div>
                      <p className="text-text-secondary">
                        {project.quoteCount} báo giá · {project.milestoneCount} milestone · {project.activityCount} hoạt động
                      </p>
                      <p className="text-text-secondary">
                        Cập nhật {formatRelativeTime(project.lastActivityAt ?? project.updatedAt)}
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <Link href={`/projects/${project.id}`} className="contents">
                          <Button size="sm" type="button" variant="outline">
                            Chi tiết
                          </Button>
                        </Link>
                        <Link href={`/projects/${project.id}/edit`} className="contents">
                          <Button size="sm" type="button" variant="ghost">
                            Sửa
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
