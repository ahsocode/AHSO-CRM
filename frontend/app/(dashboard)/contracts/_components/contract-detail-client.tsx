"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContract } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContractMilestoneManager } from "./contract-milestone-manager";
import { ContractPaymentManager } from "./contract-payment-manager";

export function ContractDetailClient({ contractId }: { contractId: string }) {
  const contractQuery = useContract(contractId);

  if (contractQuery.isLoading) {
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
          <LoadingSkeleton className="h-[760px] w-full" />
          <LoadingSkeleton className="h-[760px] w-full" />
        </div>
      </div>
    );
  }

  if (contractQuery.isError || !contractQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chi tiết hợp đồng"
          description="Không thể tải dữ liệu hợp đồng này."
          action={
            <Link href="/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(contractQuery.error, "Không thể tải dữ liệu hợp đồng.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const contract = contractQuery.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Chi tiết hợp đồng"
        description="Contract 360 gom commercial context, delivery milestone và dòng tiền trên cùng một màn hình."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
            <Link href={`/projects/${contract.project.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Mở dự án
            </Link>
          </div>
        }
      />

      <section className="surface-card noise-edge overflow-hidden border border-white/70">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="p-6 md:p-8">
            <p className="industrial-chip bg-primary/10 text-primary">Contract Desk</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl font-extrabold text-text-primary">{contract.contractNo}</h2>
              <StatusBadge kind="contract" status={contract.status} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-text-secondary">
              <Link href={`/projects/${contract.project.id}`} className="inline-flex">
                <Badge variant="info">{contract.project.code}</Badge>
              </Link>
              <Link href={`/customers/${contract.project.customer.id}`} className="inline-flex">
                <Badge variant="neutral">{contract.project.customer.name}</Badge>
              </Link>
            </div>

            <p className="mt-5 max-w-3xl text-sm text-text-secondary">
              Hợp đồng này bám theo dự án <strong className="text-text-primary">{contract.project.name}</strong> và là
              điểm đọc nhanh cho toàn bộ tiến độ thu tiền, milestone delivery và quote nguồn.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MiniPanel label="Ký ngày" value={contract.signDate ? formatDate(contract.signDate) : "Chưa cập nhật"} />
              <MiniPanel label="Bắt đầu" value={contract.startDate ? formatDate(contract.startDate) : "Chưa cập nhật"} />
              <MiniPanel label="Kết thúc" value={contract.endDate ? formatDate(contract.endDate) : "Chưa cập nhật"} />
            </div>
          </div>

          <aside className="border-t border-white/70 bg-primary/5 p-6 md:p-8 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Customer Owner</p>
            <div className="mt-4 space-y-2">
              <Link
                href={`/customers/${contract.project.customer.id}`}
                className="font-heading text-xl font-bold text-text-primary hover:text-primary"
              >
                {contract.project.customer.name}
              </Link>
              <p className="text-sm text-text-secondary">{contract.project.customer.address ?? "Chưa cập nhật địa chỉ"}</p>
              <p className="text-sm text-text-secondary">Owner: {contract.project.customer.assignedTo.name}</p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/85 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Liên hệ chính</p>
              <p className="mt-2 font-semibold text-text-primary">
                {contract.project.customer.primaryContact?.name ?? "Chưa thiết lập"}
              </p>
              <p className="text-text-secondary">
                {contract.project.customer.primaryContact?.title ?? "Chưa có chức danh"}
              </p>
              {contract.project.customer.primaryContact?.phone ? (
                <p className="text-text-secondary">{contract.project.customer.primaryContact.phone}</p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Giá trị hợp đồng" value={<CurrencyDisplay amount={contract.value} short />} />
        <MetricCard label="Đã thu" value={<CurrencyDisplay amount={contract.stats.paidAmount} short />} />
        <MetricCard label="Còn lại" value={<CurrencyDisplay amount={contract.stats.outstandingAmount} short />} />
        <MetricCard label="Tiến độ milestone" value={`${contract.stats.completionRate}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <ContractMilestoneManager contractId={contract.id} milestones={contract.milestones} />

          <ContractPaymentManager contractId={contract.id} payments={contract.payments} />

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quote Stack</p>
              <CardTitle>Báo giá nguồn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contract.project.quotes.length === 0 ? (
                <EmptyState
                  title="Chưa có báo giá nguồn"
                  description="Dự án này chưa liên kết quote. Flow hiện tại đã có route quotes để mở rộng truy vết đầy đủ."
                />
              ) : (
                contract.project.quotes.map((quote) => (
                  <article key={quote.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/quotes/${quote.id}`} className="font-semibold text-text-primary hover:text-primary">
                            {quote.quoteNo}
                          </Link>
                          <Badge variant="neutral">v{quote.version}</Badge>
                          <StatusBadge kind="quote" status={quote.status} />
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
        </div>

        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Progress</p>
              <CardTitle>Tiến độ hợp đồng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Hoàn tất milestone</span>
                <span className="font-heading text-2xl font-extrabold text-text-primary">
                  {contract.stats.completionRate}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-primary" style={{ width: `${contract.stats.completionRate}%` }} />
              </div>
              <div className="grid gap-3 text-sm text-text-secondary md:grid-cols-2 xl:grid-cols-1">
                <MiniInfo label="Tạo hợp đồng" value={formatDateTime(contract.createdAt)} />
                <MiniInfo label="Cập nhật cuối" value={formatDateTime(contract.updatedAt)} />
                <MiniInfo label="Số thanh toán" value={`${contract.stats.paymentCount}`} />
                <MiniInfo label="Milestone xong" value={`${contract.stats.completedMilestones}/${contract.stats.milestoneCount}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Project Pulse</p>
              <CardTitle>Ngữ cảnh dự án</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
                <Link href={`/projects/${contract.project.id}`} className="font-semibold text-text-primary hover:text-primary">
                  {contract.project.name}
                </Link>
                <p className="mt-1 text-text-secondary">{contract.project.code}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge kind="project" status={contract.project.status} />
                  <Badge variant="info">
                    <CurrencyDisplay amount={contract.project.estimatedValue} short />
                  </Badge>
                </div>
              </div>

              {contract.project.activities.length === 0 ? (
                <p className="text-sm text-text-secondary">Chưa có activity gần đây.</p>
              ) : (
                contract.project.activities.map((activity) => (
                  <article key={activity.id} className="flex gap-3 rounded-2xl border border-border/60 bg-white/80 p-4">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <AppIcon name="activity" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary">{activity.title}</p>
                      <p className="text-sm text-text-secondary">{activity.user.name}</p>
                      {activity.content ? <p className="mt-2 text-sm text-text-secondary">{activity.content}</p> : null}
                      <p className="mt-2 text-sm text-text-secondary">
                        Cập nhật {formatRelativeTime(activity.updatedAt)}
                      </p>
                    </div>
                  </article>
                ))
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
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
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
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <div className="mt-2 font-semibold text-text-primary">{value}</div>
    </div>
  );
}
