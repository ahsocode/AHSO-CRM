"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DocumentActions } from "@/components/shared/document-actions";
import { useAiDraftEmail } from "@/hooks/use-ai";
import { toast } from "@/hooks/use-toast";
import { useRuntimeDocumentTemplateVariants, useDocumentPreviewQuery } from "@/hooks/use-documents";
import { InlinePreviewOverlay } from "@/components/shared/inline-preview-overlay";
import { useDuplicateQuote, useQuote, useUpdateQuote, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import type { DocumentTemplateVariant, QuoteDetail, QuoteStatus, QuoteTableColumnWidths } from "@/lib/types";
import { cn } from "@/lib/utils";

const EDITABLE_QUOTE_STATUSES: QuoteStatus[] = ["DRAFT", "REJECTED"];

function buildQuoteUpdatePayload(quote: QuoteDetail, tableColumnWidths: QuoteTableColumnWidths) {
  return {
    projectId: quote.project.id,
    validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : undefined,
    taxRate: quote.taxRate,
    tableColumnWidths,
    terms: quote.terms ?? "",
    deliveryTerms: quote.deliveryTerms ?? "",
    internalNote: quote.internalNote ?? "",
    status: quote.status,
    items: quote.items.map((item) => ({
      name: item.name,
      description: item.description ?? "",
      unit: item.unit ?? "",
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }))
  };
}

const STATUS_ACTIONS: Partial<
  Record<
    QuoteStatus,
    Array<{
      label: string;
      nextStatus: QuoteStatus;
      variant: "primary" | "outline" | "destructive";
    }>
  >
> = {
  DRAFT: [{ label: "Đánh dấu đã gửi", nextStatus: "SENT", variant: "primary" }],
  REJECTED: [
    { label: "Chuyển về nháp", nextStatus: "DRAFT", variant: "outline" },
    { label: "Gửi lại báo giá", nextStatus: "SENT", variant: "primary" }
  ],
  SENT: [
    { label: "Chấp nhận", nextStatus: "ACCEPTED", variant: "primary" },
    { label: "Từ chối", nextStatus: "REJECTED", variant: "destructive" },
    { label: "Hết hạn", nextStatus: "EXPIRED", variant: "outline" }
  ],
  EXPIRED: [{ label: "Mở lại bản nháp", nextStatus: "DRAFT", variant: "outline" }]
};

export function QuoteDetailClient({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [selectedTemplateVariantId, setSelectedTemplateVariantId] = useState("");
  const [isDraftEmailOpen, setIsDraftEmailOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const quoteQuery = useQuote(quoteId);
  const templateVariantsQuery = useRuntimeDocumentTemplateVariants("QUOTATION");
  const duplicateQuoteMutation = useDuplicateQuote();
  const updateQuoteMutation = useUpdateQuote(quoteId);
  const updateQuoteStatusMutation = useUpdateQuoteStatus();
  const previewLang = quoteQuery.data?.project.customer.language === "vi-en" ? "vi-en" : "vi";
  const previewQuery = useDocumentPreviewQuery({
    type: "QUOTATION",
    entityId: quoteQuery.data?.id ?? "",
    lang: previewLang,
    templateVariantId: selectedTemplateVariantId || undefined,
    enabled: showPreview && Boolean(quoteQuery.data),
  });

  if (quoteQuery.isLoading) {
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

  if (quoteQuery.isError || !quoteQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chi tiết báo giá"
          description="Không thể tải dữ liệu của báo giá này."
          action={
            <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(quoteQuery.error, "Không thể tải dữ liệu báo giá.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quote = quoteQuery.data;
  const canEdit = EDITABLE_QUOTE_STATUSES.includes(quote.status);
  const hasContract = Boolean(quote.project.contract);
  const actionItems = hasContract ? [] : STATUS_ACTIONS[quote.status] ?? [];
  const duplicateErrorMessage = duplicateQuoteMutation.isError
    ? getApiErrorMessage(duplicateQuoteMutation.error, "Không thể tạo version báo giá mới.")
    : null;
  const statusErrorMessage = updateQuoteStatusMutation.isError
    ? getApiErrorMessage(updateQuoteStatusMutation.error, "Không thể cập nhật trạng thái báo giá.")
    : null;
  const isMutating = duplicateQuoteMutation.isPending || updateQuoteStatusMutation.isPending;
  const selectedTemplateVariant = templateVariantsQuery.data?.find((variant) => variant.id === selectedTemplateVariantId);
  const activeTemplateVariant = templateVariantsQuery.data?.find((variant) => variant.isActive);
  const selectedTemplateLabel = selectedTemplateVariant
    ? `${selectedTemplateVariant.name} · v${selectedTemplateVariant.version}`
    : activeTemplateVariant
      ? `${activeTemplateVariant.name} · v${activeTemplateVariant.version} · active`
      : "Mẫu mặc định / fallback hệ thống";

  return (
    <div className="space-y-8">
      {showPreview && (
        <InlinePreviewOverlay
          html={previewQuery.data}
          isLoading={previewQuery.isLoading}
          error={previewQuery.error as Error | null}
          title="Xem trước báo giá"
          quoteColumnResize={{
            initialWidths: quote.tableColumnWidths,
            canEdit,
            isSaving: updateQuoteMutation.isPending,
            onSave: (widths) => {
              updateQuoteMutation.mutate(buildQuoteUpdatePayload(quote, widths), {
                onSuccess: () => {
                  toast("Đã lưu độ rộng cột báo giá.");
                  void previewQuery.refetch();
                },
                onError: (error) => {
                  toast({
                    title: getApiErrorMessage(error, "Không thể lưu độ rộng cột."),
                    variant: "destructive"
                  });
                }
              });
            }
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
      <PageHeader
        title="Chi tiết báo giá"
        description="Quote workspace gom đầy đủ thông tin thương mại, danh mục chào giá và dữ liệu dự án/khách hàng trên một màn hình."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
            {quote.status === "ACCEPTED" && !hasContract ? (
              <Link
                href={`/contracts/new?projectId=${quote.project.id}&sourceQuoteId=${quote.id}`}
                className={cn(buttonVariants({ variant: "primary" }))}
              >
                Tạo hợp đồng
              </Link>
            ) : null}
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
            >
              <AppIcon name="preview" className="h-4 w-4" />
              Xem trước báo giá
            </Button>
            <Link href={`/quotes/${quote.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
              Chỉnh sửa
            </Link>
            <DocumentActions 
              entityType="quote" 
              entityId={quote.id} 
              customerLanguage={quote.project.customer.language ?? "vi"}
              templateVariantId={selectedTemplateVariantId}
              templateVariantLabel={selectedTemplateLabel}
              showTemplateSelector={false}
            />
          </div>
        }
      />

      <section className="surface-card noise-edge overflow-hidden border border-white/70">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="p-6 md:p-8">
            <p className="industrial-chip bg-primary/10 text-primary">Commercial Quote</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl font-extrabold text-text-primary">{quote.quoteNo}</h2>
              <Badge variant="neutral">v{quote.version}</Badge>
              <StatusBadge kind="quote" status={quote.status} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-text-secondary">
              <Link href={`/projects/${quote.project.id}`} className="inline-flex">
                <Badge variant="info">{quote.project.code}</Badge>
              </Link>
              <Link href={`/customers/${quote.project.customer.id}`} className="inline-flex">
                <Badge variant="neutral">{quote.project.customer.name}</Badge>
              </Link>
            </div>

            <p className="mt-5 max-w-3xl text-sm text-text-secondary">
              Báo giá này đang phục vụ dự án <strong className="text-text-primary">{quote.project.name}</strong>. Tất cả
              line item, điều khoản thương mại và thông tin liên hệ đã được gom để sales và delivery dùng chung.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MiniPanel label="Ngày tạo" value={formatDate(quote.createdAt)} />
              <MiniPanel
                label="Hiệu lực đến"
                value={quote.validUntil ? formatDate(quote.validUntil) : "Chưa đặt hạn"}
              />
              <MiniPanel label="Tạo bởi" value={quote.createdBy.name} />
            </div>
          </div>

          <aside className="border-t border-white/70 bg-primary/5 p-6 md:p-8 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Customer / Project</p>
            <div className="mt-4 space-y-2">
              <Link
                href={`/customers/${quote.project.customer.id}`}
                className="font-heading text-xl font-bold text-text-primary hover:text-primary"
              >
                {quote.project.customer.name}
              </Link>
              <p className="text-sm text-text-secondary">{quote.project.name}</p>
              <p className="text-sm text-text-secondary">Owner: {quote.project.customer.assignedTo.name}</p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/70 bg-white/85 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Liên hệ chính</p>
              <p className="mt-2 font-semibold text-text-primary">
                {quote.project.customer.primaryContact?.name ?? "Chưa thiết lập"}
              </p>
              <p className="text-text-secondary">
                {quote.project.customer.primaryContact?.title ?? "Chưa có chức danh"}
              </p>
              {quote.project.customer.primaryContact?.phone ? (
                <p className="text-text-secondary">{quote.project.customer.primaryContact.phone}</p>
              ) : null}
              {quote.project.customer.primaryContact?.email ? (
                <p className="text-text-secondary">{quote.project.customer.primaryContact.email}</p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tạm tính" value={<CurrencyDisplay amount={quote.subtotal} short />} />
        <MetricCard label={`VAT ${quote.taxRate}%`} value={<CurrencyDisplay amount={quote.taxAmount} short />} />
        <MetricCard label="Tổng cộng" value={<CurrencyDisplay amount={quote.total} short />} />
        <MetricCard label="Số hạng mục" value={`${quote.itemCount}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Item Stack</p>
              <CardTitle>Danh mục chào giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote.items.length === 0 ? (
                <EmptyState
                  title="Chưa có hạng mục"
                  description="Quote này chưa có line item. Flow tạo quote hiện tại luôn yêu cầu ít nhất 1 hạng mục để tránh draft rỗng."
                />
              ) : (
                <>
                  <div className="grid gap-4 md:hidden">
                    {quote.items.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-text-primary">
                              {String(item.order).padStart(2, "0")}. {item.name}
                            </p>
                            {item.description ? <p className="mt-2 text-sm text-text-secondary">{item.description}</p> : null}
                          </div>
                          <span className="font-heading text-xl font-extrabold text-text-primary">
                            <CurrencyDisplay amount={item.total} short />
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-text-secondary">
                          {item.quantity} {item.unit ?? "đơn vị"} · <CurrencyDisplay amount={item.unitPrice} />
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                          <th className="px-4">Hạng mục</th>
                          <th className="px-4">ĐVT / SL</th>
                          <th className="px-4">Đơn giá</th>
                          <th className="px-4">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items.map((item) => (
                          <tr key={item.id} className="bg-white/80 shadow-sm">
                            <td className="rounded-l-2xl px-4 py-4 align-top">
                              <p className="font-semibold text-text-primary">
                                {String(item.order).padStart(2, "0")}. {item.name}
                              </p>
                              {item.description ? <p className="mt-2 text-sm text-text-secondary">{item.description}</p> : null}
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-text-secondary">
                              {item.unit ?? "Đơn vị"} · {item.quantity}
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-text-secondary">
                              <CurrencyDisplay amount={item.unitPrice} />
                            </td>
                            <td className="rounded-r-2xl px-4 py-4 align-top text-sm font-semibold text-text-primary">
                              <CurrencyDisplay amount={item.total} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Commercial Terms</p>
              <CardTitle>Điều khoản thương mại</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <TermBlock
                description={quote.terms ?? "Chưa có điều khoản thanh toán cho báo giá này."}
                title="Thanh toán"
              />
              <TermBlock
                description={quote.deliveryTerms ?? "Chưa có điều khoản giao hàng/triển khai."}
                title="Giao hàng / triển khai"
              />
            </CardContent>
          </Card>

          {quote.internalNote ? (
            <Card className="border border-white/70">
              <CardHeader className="mb-0 gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Internal Notes</p>
                <CardTitle>Ghi chú nội bộ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                  {quote.internalNote}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Action Desk</p>
              <CardTitle>Workflow báo giá</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">
                  Version hiện tại: {quote.quoteNo} · v{quote.version}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span>Trạng thái:</span>
                  <StatusBadge kind="quote" status={quote.status} />
                </div>
                <p className="mt-2">
                  {hasContract
                    ? "Dự án đã có hợp đồng nên báo giá này được khóa cho việc tạo version mới và đổi trạng thái."
                    : "Bạn có thể chỉnh sửa nội dung ở bản nháp/bị từ chối, hoặc chuyển trạng thái để bám workflow sales."}
                </p>
              </div>

              <div className="grid gap-3">
                <Button
                  className="justify-start"
                  onClick={() => setIsDraftEmailOpen(true)}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  <AppIcon name="mail" className="h-4 w-4" />
                  Soạn email AI
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setShowPreview(true)}
                >
                  <AppIcon name="preview" className="h-4 w-4" />
                  Xem trước theo template đã chọn
                </Button>

                <QuoteTemplateSelector
                  activeTemplateName={activeTemplateVariant?.name}
                  isLoading={templateVariantsQuery.isLoading}
                  selectedTemplateVariantId={selectedTemplateVariantId}
                  templateVariants={templateVariantsQuery.data ?? []}
                  onChange={setSelectedTemplateVariantId}
                />

                {canEdit ? (
                  <Link href={`/quotes/${quote.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                    <AppIcon name="description" className="h-4 w-4" />
                    Chỉnh sửa version hiện tại
                  </Link>
                ) : null}

                {!hasContract ? (
                  <Button
                    className="justify-start"
                    disabled={isMutating}
                    onClick={() => {
                      duplicateQuoteMutation.mutate(quote.id, {
                        onSuccess: (duplicatedQuote) => {
                          router.push(`/quotes/${duplicatedQuote.id}`);
                        }
                      });
                    }}
                    size="lg"
                    variant="outline"
                  >
                    <AppIcon name="plus" className="h-4 w-4" />
                    {duplicateQuoteMutation.isPending ? "Đang tạo version mới..." : "Tạo version kế tiếp"}
                  </Button>
                ) : quote.project.contract ? (
                  <Link
                    href={`/contracts/${quote.project.contract.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                  >
                    Mở hợp đồng liên quan
                  </Link>
                ) : null}

                {quote.status === "ACCEPTED" && !hasContract ? (
                  <Link
                    href={`/contracts/new?projectId=${quote.project.id}&sourceQuoteId=${quote.id}`}
                    className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
                  >
                    Tạo hợp đồng từ quote này
                  </Link>
                ) : quote.project.contract ? (
                  <div className="rounded-xl bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                    Quote này đã có hợp đồng đi kèm.
                  </div>
                ) : null}

                {actionItems.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {actionItems.map((action) => {
                      const isCurrentActionPending =
                        updateQuoteStatusMutation.isPending &&
                        updateQuoteStatusMutation.variables?.quoteId === quote.id &&
                        updateQuoteStatusMutation.variables?.payload.status === action.nextStatus;

                      return (
                        <Button
                          key={action.nextStatus}
                          disabled={isMutating}
                          onClick={() => {
                            updateQuoteStatusMutation.mutate({
                              quoteId: quote.id,
                              payload: {
                                status: action.nextStatus
                              }
                            });
                          }}
                          size="lg"
                          variant={action.variant}
                        >
                          {isCurrentActionPending ? "Đang cập nhật..." : action.label}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl bg-bg-muted px-4 py-3 text-sm text-text-secondary">
                    Không còn action trạng thái trực tiếp cho quote này.
                  </div>
                )}
              </div>

              {duplicateErrorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{duplicateErrorMessage}</div>
              ) : null}
              {statusErrorMessage ? (
                <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{statusErrorMessage}</div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Timeline</p>
              <CardTitle>Mốc thương mại</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MiniInfo label="Tạo lúc" value={formatDateTime(quote.createdAt)} />
              <MiniInfo label="Cập nhật cuối" value={formatDateTime(quote.updatedAt)} />
              <MiniInfo label="Ngày gửi" value={quote.sentAt ? formatDateTime(quote.sentAt) : "Chưa gửi"} />
              <MiniInfo
                label="Ngày chấp nhận"
                value={quote.acceptedAt ? formatDateTime(quote.acceptedAt) : "Chưa chấp nhận"}
              />
              <MiniInfo
                label="Hiệu lực còn lại"
                value={quote.validUntil ? formatRelativeTime(quote.validUntil) : "Chưa đặt hạn"}
              />
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Source Project</p>
              <CardTitle>Liên kết dự án</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
                <Link href={`/projects/${quote.project.id}`} className="font-semibold text-text-primary hover:text-primary">
                  {quote.project.name}
                </Link>
                <p className="mt-1 text-text-secondary">{quote.project.code}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={quote.project.status} />
                  {quote.project.contract ? (
                    <Link href={`/contracts/${quote.project.contract.id}`} className="inline-flex">
                      <Badge variant="success">{quote.project.contract.contractNo}</Badge>
                    </Link>
                  ) : null}
                </div>
              </div>

              <MiniInfo
                label="Giá trị dự án"
                value={<CurrencyDisplay amount={quote.project.estimatedValue} short />}
              />
              {quote.project.contract ? (
                <MiniInfo
                  label="Giá trị hợp đồng"
                  value={
                    <Link href={`/contracts/${quote.project.contract.id}`} className="hover:text-primary">
                      <CurrencyDisplay amount={quote.project.contract.value} short />
                    </Link>
                  }
                />
              ) : (
                <MiniInfo label="Hợp đồng" value="Chưa tạo hợp đồng" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AiDraftEmailDialog
        isOpen={isDraftEmailOpen}
        onClose={() => setIsDraftEmailOpen(false)}
        projectId={quote.project.id}
        quoteId={quote.id}
      />
    </div>
  );
}

function AiDraftEmailDialog({
  isOpen,
  onClose,
  projectId,
  quoteId
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  quoteId: string;
}) {
  const [instruction, setInstruction] = useState("Soạn email gửi khách hàng để follow-up báo giá và đề xuất bước tiếp theo.");
  const draftEmailMutation = useAiDraftEmail();

  if (!isOpen) {
    return null;
  }

  const handleCopy = async () => {
    if (!draftEmailMutation.data) return;
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draftEmailMutation.data.subject}\n\n${draftEmailMutation.data.body}`
      );
      toast({ title: "Đã copy email AI" });
    } catch {
      toast({
        title: "Không thể copy email",
        description: "Trình duyệt đang chặn clipboard. Hãy copy thủ công từ ô nội dung."
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI Email Assistant</p>
            <h3 className="mt-2 font-heading text-2xl font-extrabold text-text-primary">Soạn email báo giá</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Nhập chỉ dẫn ngắn để AI tạo subject và nội dung email chuyên nghiệp cho báo giá này.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-text-primary" htmlFor="ai-email-instruction">
              Chỉ dẫn cho AI
            </label>
            <Textarea
              id="ai-email-instruction"
              className="mt-2 min-h-[120px]"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Ví dụ: Soạn email nhắc khách xác nhận báo giá, giọng lịch sự và có CTA đặt lịch họp."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={draftEmailMutation.isPending || instruction.trim().length < 5}
              onClick={() =>
                draftEmailMutation.mutate({
                  projectId,
                  quoteId,
                  instruction: instruction.trim()
                })
              }
            >
              <AppIcon name="mail" className="h-4 w-4" />
              {draftEmailMutation.isPending ? "Đang soạn..." : "Gửi AI"}
            </Button>
            {draftEmailMutation.data ? (
              <Button type="button" variant="outline" onClick={handleCopy}>
                Copy email
              </Button>
            ) : null}
          </div>

          {draftEmailMutation.isError ? (
            <div className="rounded-2xl border border-danger/20 bg-danger-bg/70 p-4 text-sm text-danger">
              Không thể soạn email AI. Vui lòng kiểm tra Claude API hoặc thử lại sau.
            </div>
          ) : null}

          {draftEmailMutation.data ? (
            <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <label className="text-sm font-semibold text-text-primary" htmlFor="ai-email-subject">
                  Subject
                </label>
                <input
                  id="ai-email-subject"
                  readOnly
                  className="mt-2 w-full rounded-md border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary outline-none"
                  value={draftEmailMutation.data.subject}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-text-primary" htmlFor="ai-email-body">
                  Nội dung email
                </label>
                <Textarea
                  id="ai-email-body"
                  readOnly
                  className="mt-2 min-h-[260px] bg-white"
                  value={draftEmailMutation.data.body}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuoteTemplateSelector({
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Template báo giá</p>
            <p className="mt-1 text-sm text-text-secondary">
              Chọn mẫu trước khi xem trước hoặc tạo PDF gửi khách.
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-border bg-white/70 px-4 py-3 text-sm text-text-secondary">
              Đang tải danh sách template...
            </div>
          ) : (
            <>
              <select
                aria-label="Chọn template báo giá"
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
                  : "Chưa có template báo giá đã publish; hệ thống sẽ dùng fallback hiện tại."}
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
    <Card className="border border-white/70">
      <CardContent className="space-y-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
        <div className="font-heading text-3xl font-extrabold text-text-primary">{value}</div>
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

function TermBlock({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{title}</p>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  );
}
