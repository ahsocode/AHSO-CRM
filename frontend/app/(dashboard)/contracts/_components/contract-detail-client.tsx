"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CustomFieldRenderer } from "@/components/shared/custom-field-renderer";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomFields } from "@/hooks/use-custom-fields";
import { useRuntimeDocumentTemplateVariants } from "@/hooks/use-documents";
import { useDownloadContractAcceptancePdf, useContract } from "@/hooks/use-contracts";
import { useToast } from "@/hooks/use-toast";
import { DocumentActions } from "@/components/shared/document-actions";
import { getApiErrorMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/auth";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import type { DocumentTemplateVariant } from "@/lib/types";
import { cn, downloadBlob } from "@/lib/utils";
import { ContractMilestoneManager } from "./contract-milestone-manager";
import { ContractPaymentManager } from "./contract-payment-manager";

export function ContractDetailClient({ contractId }: { contractId: string }) {
  const [selectedTemplateVariantId, setSelectedTemplateVariantId] = useState("");
  const contractQuery = useContract(contractId);
  const customFieldsQuery = useCustomFields("contract");
  const templateVariantsQuery = useRuntimeDocumentTemplateVariants("CONTRACT");
  const downloadAcceptancePdf = useDownloadContractAcceptancePdf();
  const { error: showError } = useToast();

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
  const attachmentUrl = resolveAssetUrl(contract.fileUrl);
  const selectedTemplateVariant = templateVariantsQuery.data?.find((variant) => variant.id === selectedTemplateVariantId);
  const activeTemplateVariant = templateVariantsQuery.data?.find((variant) => variant.isActive);
  const documentPreviewHref = {
    pathname: "/documents/preview",
    query: {
      type: "CONTRACT",
      entityId: contract.id,
      lang: contract.project.customer.language === "vi-en" ? "vi-en" : "vi",
      ...(selectedTemplateVariantId ? { templateVariantId: selectedTemplateVariantId } : {})
    }
  };
  const selectedTemplateLabel = selectedTemplateVariant
    ? `${selectedTemplateVariant.name} · v${selectedTemplateVariant.version}`
    : activeTemplateVariant
      ? `${activeTemplateVariant.name} · v${activeTemplateVariant.version} · active`
      : "Mẫu mặc định / fallback hệ thống";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contract Desk"
        title={contract.contractNo}
        description="Hồ sơ hợp đồng gom commercial context, milestone triển khai, dòng tiền, attachment và biên bản nghiệm thu."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
            <Link href={`/contracts/${contract.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
              Sửa hợp đồng
            </Link>
            <Link href={`/projects/${contract.project.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Mở dự án
            </Link>
            <DocumentActions 
              entityType="contract" 
              entityId={contract.id} 
              customerLanguage={contract.project.customer.language ?? "vi"}
              templateVariantId={selectedTemplateVariantId}
              templateVariantLabel={selectedTemplateLabel}
              showTemplateSelector={false}
            />
          </div>
        }
      />

      <section className="v2-shell-card noise-edge overflow-hidden border border-white/70">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="p-6 md:p-8">
            <p className="v2-label text-primary">Contract Control</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl font-extrabold tracking-[-0.03em] text-text-primary">{contract.project.name}</h2>
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

            <p className="mt-5 max-w-3xl text-sm leading-6 text-text-secondary">
              Hợp đồng này bám theo dự án <strong className="text-text-primary">{contract.project.name}</strong> và là
              điểm đọc nhanh cho toàn bộ tiến độ thu tiền, milestone delivery và quote nguồn.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MiniPanel label="Ký ngày" value={contract.signDate ? formatDate(contract.signDate) : "Chưa cập nhật"} />
              <MiniPanel label="Bắt đầu" value={contract.startDate ? formatDate(contract.startDate) : "Chưa cập nhật"} />
              <MiniPanel label="Kết thúc" value={contract.endDate ? formatDate(contract.endDate) : "Chưa cập nhật"} />
            </div>
            <div className="mt-6">
              <ContractTemplateSelector
                activeTemplateName={activeTemplateVariant?.name}
                isLoading={templateVariantsQuery.isLoading}
                selectedTemplateVariantId={selectedTemplateVariantId}
                templateVariants={templateVariantsQuery.data ?? []}
                onChange={setSelectedTemplateVariantId}
              />
            </div>
            <div className="mt-4">
              <Link
                href={documentPreviewHref}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <AppIcon name="preview" className="h-4 w-4" />
                Xem trước hợp đồng
              </Link>
            </div>
            {attachmentUrl ? (
              <div className="mt-6">
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Mở file đính kèm
                </a>
              </div>
            ) : null}
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

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dynamic Schema</p>
          <CardTitle>Custom fields</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldRenderer
            fields={customFieldsQuery.data ?? []}
            values={contract.customFieldValues ?? {}}
            emptyTitle="Chưa có custom field cho hợp đồng"
            emptyDescription="Khi admin tạo field động cho resource hợp đồng, dữ liệu sẽ hiện ở đây."
          />
        </CardContent>
      </Card>

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

function ContractTemplateSelector({
  activeTemplateName,
  isLoading,
  selectedTemplateVariantId,
  templateVariants,
  onChange
}: {
  activeTemplateName?: string;
  isLoading: boolean;
  selectedTemplateVariantId: string;
  templateVariants: DocumentTemplateVariant[];
  onChange: (variantId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
          <AppIcon name="description" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Template hợp đồng</p>
            <p className="mt-1 text-sm text-text-secondary">
              Chọn mẫu hợp đồng trước khi xem trước hoặc tạo PDF chính thức.
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-border bg-white/70 px-4 py-3 text-sm text-text-secondary">
              Đang tải danh sách template...
            </div>
          ) : (
            <>
              <select
                aria-label="Chọn template hợp đồng"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={selectedTemplateVariantId}
                onChange={(event) => onChange(event.target.value)}
              >
                <option value="">
                  {activeTemplateName ? `Mẫu active hiện tại: ${activeTemplateName}` : "Mẫu mặc định / fallback hệ thống"}
                </option>
                {templateVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name} · v{variant.version}
                    {variant.isActive ? " · active" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary">
                {templateVariants.length > 0
                  ? "Danh sách chỉ gồm các template đã publish. Nếu không chọn, hệ thống dùng mẫu active."
                  : "Chưa có template hợp đồng đã publish; hệ thống sẽ dùng fallback hiện tại."}
              </p>
            </>
          )}
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
