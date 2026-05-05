"use client";

import Link from "next/link";
import { CustomFieldRenderer } from "@/components/shared/custom-field-renderer";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { AppIcon } from "@/components/shared/app-icon";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DocumentActions } from "@/components/shared/document-actions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useCustomer } from "@/hooks/use-customers";
import { getRoleLabelByName } from "@/lib/constants";
import { formatDate, formatMonthYear, formatRelativeTime } from "@/lib/format";
import { ActivityType, ContractStatus, Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactManager } from "./contact-manager";

const PRIORITY_CONFIG: Record<
  Priority,
  {
    label: string;
    variant: "neutral" | "info" | "warning";
  }
> = {
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

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CALL: "Cuộc gọi",
  EMAIL: "Email",
  MEETING: "Họp",
  SURVEY: "Khảo sát",
  DEMO: "Demo",
  NOTE: "Ghi chú",
  FOLLOWUP: "Follow-up"
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Không thể tải chi tiết khách hàng.";
}

export function CustomerDetailClient({ customerId }: { customerId: string }) {
  const customerQuery = useCustomer(customerId);
  const customFieldsQuery = useCustomFields("customer");

  if (customerQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-64 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <LoadingSkeleton className="h-[480px] w-full" />
          <LoadingSkeleton className="h-[480px] w-full" />
        </div>
      </div>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chi tiết khách hàng"
          description="Không thể tải dữ liệu của khách hàng này."
          action={
            <Link href="/customers" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getErrorMessage(customerQuery.error)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customer = customerQuery.data;
  const stats = customer.stats;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chi tiết khách hàng"
        description="Customer 360 cho sales và delivery: thông tin doanh nghiệp, đầu mối, dự án, hoạt động gần nhất."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/customers/${customerId}/edit`} className={cn(buttonVariants({ variant: "primary" }))}>
              Chỉnh sửa
            </Link>
            <DocumentActions 
              entityType="customer" 
              entityId={customerId} 
              customerLanguage={customer.language ?? "vi"} 
            />
            <Link href="/customers" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          </div>
        }
      />

      <section className="surface-card noise-edge overflow-hidden border border-white/70">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="p-6 md:p-8">
            <p className="industrial-chip bg-primary/10 text-primary">Customer 360</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl font-extrabold text-text-primary">{customer.name}</h2>
              <StatusBadge status={customer.status} />
              {customer.isVip ? <Badge variant="warning">VIP</Badge> : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-text-secondary">
              {customer.shortName ? <Badge variant="neutral">{customer.shortName}</Badge> : null}
              <Badge variant="info">{customer.industry ?? "Chưa phân ngành"}</Badge>
              <Badge variant="neutral">{customer.taxCode ?? "Chưa có MST"}</Badge>
            </div>

            <p className="mt-5 max-w-3xl text-sm text-text-secondary">
              {customer.notes ??
                "Khách hàng đã được đồng bộ vào CRM. Bổ sung ghi chú thương mại, rủi ro và kỳ vọng triển khai tại đây để toàn đội cùng theo dõi."}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quan hệ từ</p>
                <p className="mt-2 font-heading text-xl font-bold text-text-primary">
                  {formatMonthYear(stats.customerSince)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Nguồn khách</p>
                <p className="mt-2 font-semibold text-text-primary">{customer.source ?? "Chưa gắn nguồn"}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Cập nhật gần nhất</p>
                <p className="mt-2 font-semibold text-text-primary">{formatRelativeTime(customer.updatedAt)}</p>
              </div>
            </div>
          </div>

          <aside className="border-t border-white/70 bg-primary/5 p-6 md:p-8 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Người phụ trách</p>
            <div className="mt-4 flex items-center gap-4">
              <AvatarInitials name={customer.assignedTo.name} className="h-14 w-14 rounded-full text-base" />
              <div>
                <p className="font-heading text-xl font-bold text-text-primary">{customer.assignedTo.name}</p>
                <p className="text-sm text-text-secondary">{getRoleLabelByName(customer.assignedTo.role)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Đầu mối liên hệ</p>
                <p className="mt-2 font-semibold text-text-primary">{customer.contacts[0]?.name ?? "Chưa thiết lập"}</p>
                <p className="text-text-secondary">{customer.contacts[0]?.title ?? "Chưa có chức danh"}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Nhịp hoạt động</p>
                <p className="mt-2 font-semibold text-text-primary">{customer.activities.length} tương tác gần đây</p>
                <p className="text-text-secondary">{customer.projects.length} dự án đang gắn trên CRM</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tổng giá trị hợp đồng" value={<CurrencyDisplay amount={stats.totalContractValue} short />} />
        <MetricCard label="Dự án đang hoạt động" value={stats.activeProjects} />
        <MetricCard label="Tổng dự án" value={stats.projectCount} />
        <MetricCard label="Báo giá đã phát sinh" value={stats.recentQuoteCount} />
      </div>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dynamic Schema</p>
          <CardTitle>Custom fields</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldRenderer
            fields={customFieldsQuery.data ?? []}
            values={customer.customFieldValues ?? {}}
            emptyTitle="Chưa có custom field cho khách hàng"
            emptyDescription="Khi admin tạo field động cho resource khách hàng, dữ liệu sẽ hiện ở đây."
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Delivery Snapshot</p>
              <CardTitle>Dự án đang gắn với khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.projects.length === 0 ? (
                <EmptyState
                  title="Chưa có dự án"
                  description="Khách hàng này chưa được gắn dự án. Phase tiếp theo có thể mở rộng từ danh sách báo giá hoặc khảo sát."
                />
              ) : (
                customer.projects.map((project) => (
                  <article key={project.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-lg font-bold text-text-primary">{project.name}</p>
                          <StatusBadge status={project.status} />
                          <Badge variant={PRIORITY_CONFIG[project.priority].variant}>
                            {PRIORITY_CONFIG[project.priority].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-secondary">
                          {project.code} · Dự kiến kết thúc {project.expectedEndDate ? formatDate(project.expectedEndDate) : "chưa xác định"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-2xl font-extrabold text-text-primary">
                          <CurrencyDisplay amount={project.estimatedValue} short />
                        </p>
                        <p className="text-sm text-text-secondary">{project.progressPercent}% tiến độ quy ước</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-text-secondary md:grid-cols-3">
                      <div className="rounded-xl bg-bg-hover/60 p-3">
                        <p className="font-semibold text-text-primary">{project.quoteCount} báo giá</p>
                        <p>Đã tạo cho dự án này</p>
                      </div>
                      <div className="rounded-xl bg-bg-hover/60 p-3">
                        <p className="font-semibold text-text-primary">{project.milestoneCount} milestone</p>
                        <p>Theo dõi delivery</p>
                      </div>
                      <div className="rounded-xl bg-bg-hover/60 p-3">
                        {project.contract ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/contracts/${project.contract.id}`}
                                className="font-semibold text-text-primary hover:text-primary"
                              >
                                {project.contract.contractNo}
                              </Link>
                              <Badge variant={CONTRACT_STATUS_CONFIG[project.contract.status].variant}>
                                {CONTRACT_STATUS_CONFIG[project.contract.status].label}
                              </Badge>
                            </div>
                            <p className="mt-1">
                              <CurrencyDisplay amount={project.contract.value} short />
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-text-primary">Chưa có hợp đồng</p>
                            <p>Project chưa qua bước ký kết</p>
                          </>
                        )}
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
              {customer.activities.length === 0 ? (
                <EmptyState
                  title="Chưa có hoạt động"
                  description="Khi sales hoặc delivery log cuộc gọi, email và ghi chú, timeline này sẽ là nơi nhìn nhanh toàn bộ bối cảnh."
                />
              ) : (
                customer.activities.map((activity) => (
                  <article key={activity.id} className="flex gap-4 rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <AppIcon name="activity" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-text-primary">{activity.title}</p>
                          <p className="text-sm text-text-secondary">
                            {ACTIVITY_LABELS[activity.type]} · {activity.user.name}
                          </p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Company Brief</p>
              <CardTitle>Thông tin doanh nghiệp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <InfoRow label="Địa chỉ" value={customer.address ?? "Chưa bổ sung"} />
              <InfoRow label="Website" value={customer.website} href={customer.website ?? undefined} />
              <InfoRow label="Email công ty" value={customer.email} />
              <InfoRow label="Điện thoại công ty" value={customer.phone} />
              <InfoRow label="Ngày tạo hồ sơ" value={formatDate(customer.createdAt)} />
              <InfoRow label="Cập nhật cuối" value={formatDate(customer.updatedAt)} />
            </CardContent>
          </Card>

          <ContactManager contacts={customer.contacts} customerId={customerId} />
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

function InfoRow({
  label,
  value,
  href
}: {
  label: string;
  value?: string | null;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      {href && value ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 block font-semibold text-primary hover:underline">
          {value}
        </a>
      ) : (
        <p className="mt-2 font-semibold text-text-primary">{value ?? "Chưa bổ sung"}</p>
      )}
    </div>
  );
}
