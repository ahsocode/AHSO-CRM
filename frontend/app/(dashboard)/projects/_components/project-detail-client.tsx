"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CustomFieldRenderer } from "@/components/shared/custom-field-renderer";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentActions } from "@/components/shared/document-actions";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useProject } from "@/hooks/use-projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { ContractStatus, MilestoneStatus, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "neutral" | "info" | "warning" }> = {
  LOW: { label: "Ưu tiên thấp", variant: "neutral" },
  NORMAL: { label: "Ưu tiên chuẩn", variant: "info" },
  HIGH: { label: "Ưu tiên cao", variant: "warning" }
};

const CONTRACT_STATUS_CONFIG: Record<
  ContractStatus,
  {
    label: string;
    variant: "info" | "warning" | "success" | "danger";
  }
> = {
  ACTIVE: { label: "Hiệu lực", variant: "info" },
  SUSPENDED: { label: "Tạm dừng", variant: "warning" },
  COMPLETED: { label: "Hoàn tất", variant: "success" },
  CANCELLED: { label: "Hủy", variant: "danger" }
};

const MILESTONE_STATUS_CONFIG: Record<
  MilestoneStatus,
  {
    label: string;
    variant: "neutral" | "info" | "success" | "warning";
  }
> = {
  PENDING: { label: "Chờ xử lý", variant: "neutral" },
  IN_PROGRESS: { label: "Đang làm", variant: "info" },
  DONE: { label: "Đã xong", variant: "success" },
  ACCEPTED: { label: "Đã nghiệm thu", variant: "warning" }
};

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const projectQuery = useProject(projectId);
  const customFieldsQuery = useCustomFields("project");

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-72 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <LoadingSkeleton className="h-[720px] w-full" />
          <LoadingSkeleton className="h-[720px] w-full" />
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chi tiết dự án"
          description="Không thể tải dữ liệu của dự án này."
          action={
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(projectQuery.error, "Không thể tải dữ liệu dự án.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chi tiết dự án"
        description="Giao diện theo dõi cơ hội và delivery cho từng dự án, gom đầy đủ quote, contract, milestone và activity."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
            <Link href={`/projects/${projectId}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
              Sửa dự án
            </Link>
            {project.contract ? (
              <Link href={`/contracts/${project.contract.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Mở hợp đồng
              </Link>
            ) : (
              <Link href={`/contracts/new?projectId=${projectId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Tạo hợp đồng
              </Link>
            )}
            <DocumentActions 
              entityType="project" 
              entityId={projectId} 
              customerLanguage={project.customer.language ?? "vi"} 
            />
            <Link href={`/quotes/new?projectId=${projectId}`} className={cn(buttonVariants({ variant: "primary" }))}>
              Tạo báo giá
            </Link>
          </div>
        }
      />

      <section className="surface-card noise-edge overflow-hidden border border-white/70">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="p-6 md:p-8">
            <p className="industrial-chip bg-primary/10 text-primary">Project 360</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl font-extrabold text-text-primary">{project.name}</h2>
              <StatusBadge kind="project" status={project.status} />
              <Badge variant={PRIORITY_CONFIG[project.priority].variant}>
                {PRIORITY_CONFIG[project.priority].label}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-text-secondary">
              <Badge variant="neutral">{project.code}</Badge>
              <Link href={`/customers/${project.customer.id}`} className="inline-flex">
                <Badge variant="info">{project.customer.name}</Badge>
              </Link>
            </div>

            <p className="mt-5 max-w-3xl text-sm text-text-secondary">
              {project.description ?? project.notes ?? "Dự án chưa có mô tả kỹ thuật chi tiết."}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MiniPanel label="Bắt đầu" value={project.startDate ? formatDate(project.startDate) : "Chưa xác định"} />
              <MiniPanel
                label="Đích dự kiến"
                value={project.expectedEndDate ? formatDate(project.expectedEndDate) : "Chưa xác định"}
              />
              <MiniPanel label="Cập nhật cuối" value={formatRelativeTime(project.updatedAt)} />
            </div>
          </div>

          <aside className="border-t border-white/70 bg-primary/5 p-6 md:p-8 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Customer Owner</p>
            <div className="mt-4 space-y-2">
              <Link href={`/customers/${project.customer.id}`} className="font-heading text-xl font-bold text-text-primary hover:text-primary">
                {project.customer.name}
              </Link>
              <p className="text-sm text-text-secondary">{project.customer.industry ?? "Chưa phân ngành"}</p>
              <StatusBadge status={project.customer.status} />
            </div>

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/85 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Liên hệ chính</p>
              <p className="mt-2 font-semibold text-text-primary">
                {project.customer.primaryContact?.name ?? "Chưa thiết lập"}
              </p>
              <p className="text-text-secondary">{project.customer.primaryContact?.title ?? "Chưa có chức danh"}</p>
              {project.customer.primaryContact?.phone ? <p className="text-text-secondary">{project.customer.primaryContact.phone}</p> : null}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Giá trị dự kiến" value={<CurrencyDisplay amount={project.estimatedValue} short />} />
        <MetricCard label="Đã thu" value={<CurrencyDisplay amount={project.stats.paidAmount} short />} />
        <MetricCard label="Còn lại" value={<CurrencyDisplay amount={project.stats.outstandingAmount} short />} />
        <MetricCard label="Tiến độ" value={`${project.stats.progressPercent}%`} />
      </div>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dynamic Schema</p>
          <CardTitle>Custom fields</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldRenderer
            fields={customFieldsQuery.data ?? []}
            values={project.customFieldValues ?? {}}
            emptyTitle="Chưa có custom field cho dự án"
            emptyDescription="Khi admin tạo field động cho resource dự án, dữ liệu sẽ hiện ở đây."
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Milestone Map</p>
              <CardTitle>Các mốc triển khai</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.milestones.length === 0 ? (
                <EmptyState
                  title="Chưa có milestone"
                  description="Dự án này chưa được lập mốc triển khai. Backend đã sẵn sàng để mở rộng milestone CRUD sau."
                />
              ) : (
                project.milestones.map((milestone) => (
                  <article key={milestone.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-text-primary">{milestone.name}</p>
                          <Badge variant={MILESTONE_STATUS_CONFIG[milestone.status].variant}>
                            {MILESTONE_STATUS_CONFIG[milestone.status].label}
                          </Badge>
                        </div>
                        {milestone.description ? <p className="mt-2 text-sm text-text-secondary">{milestone.description}</p> : null}
                      </div>
                      <div className="text-right text-sm text-text-secondary">
                        <p>{milestone.dueDate ? `Hạn ${formatDate(milestone.dueDate)}` : "Chưa đặt hạn"}</p>
                        <p>{milestone.completedAt ? `Xong ${formatDate(milestone.completedAt)}` : "Chưa hoàn tất"}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-text-secondary">
                      <span>Ngân sách mốc: <CurrencyDisplay amount={milestone.paymentAmount} short /></span>
                      {milestone.notes ? <p className="mt-1">{milestone.notes}</p> : null}
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quote Stack</p>
              <CardTitle>Báo giá liên quan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.quotes.length === 0 ? (
                <EmptyState
                  title="Chưa có báo giá"
                  description="Dự án này chưa có quote gắn vào. Phase tiếp theo có thể nối luôn route tạo báo giá từ project."
                />
              ) : (
                project.quotes.map((quote) => (
                  <article key={quote.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/quotes/${quote.id}`} className="font-semibold text-text-primary hover:text-primary">
                            {quote.quoteNo}
                          </Link>
                          <Badge variant="neutral">v{quote.version}</Badge>
                          <StatusBadge status={quote.status} />
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">Tạo bởi {quote.createdBy.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-2xl font-extrabold text-text-primary">
                          <CurrencyDisplay amount={quote.total} short />
                        </p>
                        <p className="text-sm text-text-secondary">
                          {quote.validUntil ? `Hiệu lực đến ${formatDate(quote.validUntil)}` : "Chưa đặt hạn"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Activity Pulse</p>
              <CardTitle>Hoạt động gần đây</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.activities.length === 0 ? (
                <EmptyState
                  title="Chưa có hoạt động"
                  description="Khi đội sales và delivery log sự kiện, timeline dự án sẽ là nơi đọc nhanh toàn bộ diễn biến."
                />
              ) : (
                project.activities.map((activity) => (
                  <article key={activity.id} className="flex gap-4 rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <AppIcon name="activity" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-text-primary">{activity.title}</p>
                          <p className="text-sm text-text-secondary">{activity.user.name}</p>
                        </div>
                        <Badge variant={activity.isCompleted ? "success" : "info"}>
                          {activity.isCompleted ? "Đã hoàn tất" : "Đang mở"}
                        </Badge>
                      </div>
                      {activity.content ? <p className="mt-3 text-sm text-text-secondary">{activity.content}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-text-secondary">
                        <span>Cập nhật {formatRelativeTime(activity.updatedAt)}</span>
                        {activity.scheduledAt ? <span>Lịch {formatDate(activity.scheduledAt)}</span> : null}
                        {activity.doneAt ? <span>Xong {formatDate(activity.doneAt)}</span> : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Progress</p>
              <CardTitle>Tiến độ dự án</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Mức hoàn thành quy ước</span>
                <span className="font-heading text-2xl font-extrabold text-text-primary">{project.progressPercent}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
              </div>
              <div className="grid gap-3 text-sm text-text-secondary md:grid-cols-2 xl:grid-cols-1">
                <MiniInfo label="Tạo dự án" value={formatDateTime(project.createdAt)} />
                <MiniInfo label="Cập nhật cuối" value={formatDateTime(project.updatedAt)} />
                <MiniInfo label="Số báo giá" value={`${project.stats.quoteCount}`} />
                <MiniInfo label="Số milestone" value={`${project.stats.milestoneCount}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Contract Desk</p>
              <CardTitle>Thông tin hợp đồng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.contract ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/contracts/${project.contract.id}`}
                      className="font-heading text-2xl font-extrabold text-text-primary hover:text-primary"
                    >
                      {project.contract.contractNo}
                    </Link>
                    <Badge variant={CONTRACT_STATUS_CONFIG[project.contract.status].variant}>
                      {CONTRACT_STATUS_CONFIG[project.contract.status].label}
                    </Badge>
                  </div>
                  <div className="grid gap-3 text-sm text-text-secondary">
                    <MiniInfo
                      label="Giá trị hợp đồng"
                      value={
                        <Link href={`/contracts/${project.contract.id}`} className="hover:text-primary">
                          <CurrencyDisplay amount={project.contract.value} short />
                        </Link>
                      }
                    />
                    <MiniInfo label="Đã thu" value={<CurrencyDisplay amount={project.contract.paidAmount} short />} />
                    <MiniInfo label="Còn lại" value={<CurrencyDisplay amount={project.contract.outstandingAmount} short />} />
                    <MiniInfo label="Ký ngày" value={project.contract.signDate ? formatDate(project.contract.signDate) : "Chưa cập nhật"} />
                    <MiniInfo label="Bắt đầu" value={project.contract.startDate ? formatDate(project.contract.startDate) : "Chưa cập nhật"} />
                    <MiniInfo label="Kết thúc" value={project.contract.endDate ? formatDate(project.contract.endDate) : "Chưa cập nhật"} />
                  </div>

                  <div className="space-y-3 border-t border-border/60 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Lịch sử thanh toán</p>
                    {project.contract.payments.length === 0 ? (
                      <p className="text-sm text-text-secondary">Chưa có thanh toán.</p>
                    ) : (
                      project.contract.payments.map((payment) => (
                        <div key={payment.id} className="rounded-xl bg-bg-hover/60 p-3 text-sm text-text-secondary">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-text-primary">
                              <CurrencyDisplay amount={payment.amount} short />
                            </span>
                            <span>{formatDate(payment.paidAt)}</span>
                          </div>
                          <p className="mt-1">{payment.method ?? "Chưa rõ phương thức"} · {payment.reference ?? "Chưa có mã tham chiếu"}</p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Chưa có hợp đồng"
                  description="Dự án này chưa được gắn contract. Khi quote được chốt, card này sẽ là trung tâm theo dõi dòng tiền."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="metric-sheen noise-edge border border-white/70">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
        <p className="mt-3 font-heading text-3xl font-extrabold text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniPanel({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function MiniInfo({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}
