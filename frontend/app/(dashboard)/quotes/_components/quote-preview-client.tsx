"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDownloadQuotePdf, useQuote, useUpdateQuoteTableLayout } from "@/hooks/use-quotes";
import { useCompanyInfo, useLogo, usePolicies } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/auth";
import { formatDate, normalizeItemDescription } from "@/lib/format";
import type { QuoteDetail, QuoteTableColumnWidths } from "@/lib/types";
import { cn, downloadBlob } from "@/lib/utils";

const EDITABLE_QUOTE_STATUSES = ["DRAFT", "REJECTED"] as const;

const DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS: QuoteTableColumnWidths = {
  index: 6,
  name: 41,
  description: 23,
  quantity: 6,
  unitPrice: 12,
  total: 12
};

const QUOTE_TABLE_COLUMNS = [
  { key: "index", label: "STT", min: 3, max: 25 },
  { key: "name", label: "Hạng mục", min: 10, max: 75 },
  { key: "description", label: "Mô tả", min: 10, max: 75 },
  { key: "quantity", label: "SL", min: 3, max: 25 },
  { key: "unitPrice", label: "Đơn giá", min: 6, max: 40 },
  { key: "total", label: "Thành tiền", min: 6, max: 40 }
] as const;

type QuoteTableColumnKey = (typeof QUOTE_TABLE_COLUMNS)[number]["key"];

interface ColumnResizeState {
  columnIndex: number;
  startClientX: number;
  startWidths: QuoteTableColumnWidths;
}

function normalizeQuoteTableWidths(widths?: QuoteTableColumnWidths | null) {
  const next = widths ?? DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS;
  const total = Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0) || 1;

  return {
    index: roundColumnWidth((next.index / total) * 100),
    name: roundColumnWidth((next.name / total) * 100),
    description: roundColumnWidth((next.description / total) * 100),
    quantity: roundColumnWidth((next.quantity / total) * 100),
    unitPrice: roundColumnWidth((next.unitPrice / total) * 100),
    total: roundColumnWidth((next.total / total) * 100)
  };
}

function roundColumnWidth(value: number) {
  return Math.round(value * 100) / 100;
}

function clampColumnWidth(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function adjustAdjacentColumnWidths(
  widths: QuoteTableColumnWidths,
  columnIndex: number,
  deltaPercent: number
): QuoteTableColumnWidths {
  const leftColumn = QUOTE_TABLE_COLUMNS[columnIndex];
  const rightColumn = QUOTE_TABLE_COLUMNS[columnIndex + 1];
  if (!leftColumn || !rightColumn) {
    return widths;
  }

  const leftKey = leftColumn.key;
  const rightKey = rightColumn.key;
  const leftWidth = widths[leftKey];
  const rightWidth = widths[rightKey];
  const pairTotal = leftWidth + rightWidth;
  const minLeft = Math.max(leftColumn.min, pairTotal - rightColumn.max);
  const maxLeft = Math.min(leftColumn.max, pairTotal - rightColumn.min);
  const nextLeft = clampColumnWidth(leftWidth + deltaPercent, minLeft, maxLeft);
  const nextRight = pairTotal - nextLeft;

  return {
    ...widths,
    [leftKey]: roundColumnWidth(nextLeft),
    [rightKey]: roundColumnWidth(nextRight)
  };
}

function getColumnDividerPosition(widths: QuoteTableColumnWidths, columnIndex: number) {
  return QUOTE_TABLE_COLUMNS.slice(0, columnIndex + 1).reduce(
    (sum, column) => sum + widths[column.key],
    0
  );
}

function areQuoteTableWidthsEqual(left: QuoteTableColumnWidths, right: QuoteTableColumnWidths) {
  return QUOTE_TABLE_COLUMNS.every((column) => Math.abs(left[column.key] - right[column.key]) < 0.05);
}

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

export function QuotePreviewClient({ quoteId }: { quoteId: string }) {
  const quoteQuery = useQuote(quoteId);
  const companyQuery = useCompanyInfo();
  const policiesQuery = usePolicies();
  const logoQuery = useLogo();
  const downloadMutation = useDownloadQuotePdf();
  const updateTableLayoutMutation = useUpdateQuoteTableLayout(quoteId);
  const { error: showError, success: showSuccess } = useToast();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<ColumnResizeState | null>(null);
  const [draftTableWidths, setDraftTableWidths] = useState<QuoteTableColumnWidths>(
    DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS
  );

  useEffect(() => {
    if (quoteQuery.data) {
      setDraftTableWidths(normalizeQuoteTableWidths(quoteQuery.data.tableColumnWidths));
    }
  }, [quoteQuery.data]);


  if (quoteQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full print:hidden" />
        <LoadingSkeleton className="h-[920px] w-full" />
      </div>
    );
  }

  if (quoteQuery.isError || !quoteQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Xem trước báo giá"
          description="Không thể tải dữ liệu để render bản in."
          action={
            <Link href="/quotes" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
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
  const company = companyQuery.data;
  const policies = policiesQuery.data;
  const logoUrl = resolveAssetUrl(logoQuery.data);
  const brandName = company?.shortName || company?.name || "AHSO";
  const paymentTerms = quote.terms?.trim() || policies?.paymentTerms?.trim() || "Điều khoản thanh toán sẽ được xác nhận khi chốt PO/HĐ.";
  const deliveryTerms =
    quote.deliveryTerms?.trim() ||
    policies?.service?.trim() ||
    "Tiến độ triển khai sẽ được xác nhận theo survey và lịch điều động kỹ thuật.";
  const savedTableWidths = normalizeQuoteTableWidths(quote.tableColumnWidths);
  const tableWidths = normalizeQuoteTableWidths(draftTableWidths);
  const isEditableQuote = EDITABLE_QUOTE_STATUSES.includes(
    quote.status as (typeof EDITABLE_QUOTE_STATUSES)[number]
  );
  const hasUnsavedColumnWidths = !areQuoteTableWidthsEqual(tableWidths, savedTableWidths);
  const canDragColumns = !updateTableLayoutMutation.isPending;
  const handleDownloadPdf = () => {
    if (downloadMutation.isPending || hasUnsavedColumnWidths) {
      return;
    }

    downloadMutation.mutate(quote.id, {
      onSuccess: ({ blob, filename }) => {
        downloadBlob(blob, filename);
      },
      onError: (downloadError) => {
        showError(getApiErrorMessage(downloadError, "Không thể tải PDF báo giá."));
      }
    });
  };

  return (
    <div className="space-y-8 print:space-y-0">
      <style>{`@media print { @page { size: A4; margin: 0; } .quote-column-resize-layer, .quote-column-resize-handle { display: none !important; visibility: hidden !important; } }`}</style>
      <PageHeader
        className="print:hidden"
        eyebrow="Quotation Preview"
        title="Xem trước bản in"
        description="Canvas A4 để rà lại nội dung thương mại trước khi in hoặc tải PDF chuẩn gửi khách."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/quotes/${quote.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Về chi tiết
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={downloadMutation.isPending || hasUnsavedColumnWidths}
              onClick={handleDownloadPdf}
            >
              {downloadMutation.isPending ? "Đang tạo PDF..." : "Tải PDF"}
            </Button>
            <Button
              onClick={handleDownloadPdf}
              type="button"
              disabled={downloadMutation.isPending || hasUnsavedColumnWidths}
            >
              {downloadMutation.isPending ? "Đang tạo PDF..." : "In / Lưu PDF"}
            </Button>
          </div>
        }
      />

      <Card className="border border-white/70 print:hidden">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-text-secondary">
          <div>
            <p className="font-semibold text-text-primary">Chỉnh độ rộng cột trực tiếp trên bản review</p>
            <p className="mt-1">Kéo các vạch chia ở đầu bảng báo giá, sau đó lưu để PDF backend dùng đúng layout này.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedColumnWidths ? (
              <Badge variant="warning">Chưa lưu độ rộng</Badge>
            ) : (
              <Badge variant="neutral">Đã đồng bộ</Badge>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={updateTableLayoutMutation.isPending}
              onClick={() => setDraftTableWidths(savedTableWidths)}
            >
              Hủy thay đổi
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={updateTableLayoutMutation.isPending}
              onClick={() => setDraftTableWidths(DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS)}
            >
              Mặc định
            </Button>
            <Button
              type="button"
              disabled={!hasUnsavedColumnWidths || updateTableLayoutMutation.isPending}
              onClick={() => {
                updateTableLayoutMutation.mutate(tableWidths, {
                  onSuccess: () => showSuccess("Đã lưu độ rộng cột báo giá."),
                  onError: (updateError) => {
                    showError(getApiErrorMessage(updateError, "Không thể lưu độ rộng cột."));
                  }
                });
              }}
            >
              {updateTableLayoutMutation.isPending ? "Đang lưu..." : "Lưu độ rộng"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-[28px] bg-slate-300/25 p-4 shadow-inner md:p-8 print:bg-transparent print:p-0 print:shadow-none">
        <article className="mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-[14mm] text-sm text-slate-800 shadow-2xl print:min-h-0 print:max-w-none print:shadow-none">
          <header className="flex items-start justify-between gap-8">
            <div className="max-w-[46%]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={brandName}
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <img src="/crm-logo.png" alt="AHSO CRM" className="h-full w-full object-contain" />
                  )}
                </div>
                <div>
                  <p className="font-heading text-2xl font-extrabold tracking-tight text-primary">
                    {company?.name || "AHSO CRM"}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                    Automation Hub
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-[48%] text-right text-[11px] leading-5 text-slate-600">
              {company?.address ? <p>{company.address}</p> : null}
              {company?.phone || company?.email ? (
                <p>
                  {company?.phone ? `Hotline: ${company.phone}` : ""}
                  {company?.phone && company?.email ? " | " : ""}
                  {company?.email ? `Email: ${company.email}` : ""}
                </p>
              ) : null}
              {company?.website || company?.taxId ? (
                <p>
                  {company?.website ? `Website: ${company.website}` : ""}
                  {company?.website && company?.taxId ? " | " : ""}
                  {company?.taxId ? `MST: ${company.taxId}` : ""}
                </p>
              ) : null}
            </div>
          </header>

          <div className="mt-5 h-[2px] bg-primary" />

          <section className="mt-7 text-center">
            <h1 className="font-heading text-4xl font-extrabold uppercase tracking-[0.18em] text-primary">Báo Giá</h1>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Số: {quote.quoteNo} · v{quote.version}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ngày lập: {formatDate(quote.createdAt)}</p>
          </section>

          <section className="mt-8 rounded-2xl border-l-4 border-primary bg-slate-50 px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Kính gửi khách hàng</p>
                <p className="mt-2 font-bold text-primary">{quote.project.customer.name}</p>
                <p className="mt-2 text-xs text-slate-600">
                  Người liên hệ: {quote.project.customer.primaryContact?.name ?? "Chưa thiết lập"}
                  {quote.project.customer.primaryContact?.title ? ` - ${quote.project.customer.primaryContact.title}` : ""}
                </p>
                {quote.project.customer.taxCode ? (
                  <p className="text-xs text-slate-600">MST: {quote.project.customer.taxCode}</p>
                ) : null}
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Địa chỉ giao hàng</p>
                <p className="mt-2 text-xs text-slate-600">
                  {quote.project.customer.address ?? "Địa chỉ sẽ được xác nhận khi chốt PO/HĐ."}
                </p>
                {quote.project.customer.primaryContact?.phone ? (
                  <p className="mt-1 text-xs text-slate-600">Điện thoại: {quote.project.customer.primaryContact.phone}</p>
                ) : null}
                {quote.validUntil ? <p className="mt-1 text-xs text-slate-600">Hiệu lực đến: {formatDate(quote.validUntil)}</p> : null}
              </div>
            </div>
          </section>

          <p className="mt-6 text-xs leading-6 text-slate-600">
            AHSO xin chân thành cảm ơn Quý khách hàng đã quan tâm đến giải pháp của chúng tôi. Căn cứ theo nhu cầu của dự án{" "}
            <span className="font-semibold text-slate-800">{quote.project.name}</span>, chúng tôi gửi báo giá chi tiết như sau:
          </p>

          <section
            ref={tableContainerRef}
            className={cn(
              "relative mt-5 overflow-hidden rounded-2xl border border-slate-200",
              canDragColumns ? "select-none" : ""
            )}
          >
            <table className="min-w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: `${tableWidths.index.toFixed(4)}%` }} />
                <col style={{ width: `${tableWidths.name.toFixed(4)}%` }} />
                <col style={{ width: `${tableWidths.description.toFixed(4)}%` }} />
                <col style={{ width: `${tableWidths.quantity.toFixed(4)}%` }} />
                <col style={{ width: `${tableWidths.unitPrice.toFixed(4)}%` }} />
                <col style={{ width: `${tableWidths.total.toFixed(4)}%` }} />
              </colgroup>
              <thead>
                <tr className="bg-primary text-left text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  <th className="px-3 py-3">STT</th>
                  <th className="px-3 py-3">Hạng mục</th>
                  <th className="px-3 py-3">Mô tả</th>
                  <th className="px-3 py-3 text-center">SL</th>
                  <th className="px-3 py-3 text-right">Đơn giá</th>
                  <th className="px-3 py-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {quote.items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-3 text-center">{String(index + 1).padStart(2, "0")}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800">{item.name}</p>
                    </td>
                    <td className="whitespace-pre-wrap px-3 py-3 text-slate-500">{normalizeItemDescription(item.description ?? "")}</td>
                    <td className="px-3 py-3 text-center">{item.quantity}</td>
                    <td className="px-3 py-3 text-right">
                      <CurrencyDisplay amount={item.unitPrice} />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      <CurrencyDisplay amount={item.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canDragColumns ? (
              <div className="quote-column-resize-layer pointer-events-none absolute inset-x-0 top-0 h-12 print:hidden">
                {QUOTE_TABLE_COLUMNS.slice(0, -1).map((column, index) => (
                  <button
                    key={column.key}
                    type="button"
                    aria-label={`Kéo để chỉnh cột ${column.label}`}
                    className="quote-column-resize-handle pointer-events-auto absolute top-0 flex h-full w-5 -translate-x-1/2 cursor-col-resize items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/80"
                    style={{ left: `${getColumnDividerPosition(tableWidths, index)}%` }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      resizeRef.current = {
                        columnIndex: index,
                        startClientX: event.clientX,
                        startWidths: tableWidths
                      };
                      document.body.style.cursor = "col-resize";
                      document.body.style.userSelect = "none";
                    }}
                    onPointerMove={(event) => {
                      const resize = resizeRef.current;
                      const tableWidthPx = tableContainerRef.current?.getBoundingClientRect().width ?? 0;
                      if (!resize || tableWidthPx <= 0) return;
                      const deltaPercent = ((event.clientX - resize.startClientX) / tableWidthPx) * 100;
                      setDraftTableWidths(
                        adjustAdjacentColumnWidths(resize.startWidths, resize.columnIndex, deltaPercent)
                      );
                    }}
                    onPointerUp={() => {
                      resizeRef.current = null;
                      document.body.style.cursor = "";
                      document.body.style.userSelect = "";
                    }}
                  >
                    <span className="h-9 w-1 rounded-full bg-white/85 shadow" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mt-6 flex justify-end">
            <div className="w-full max-w-[320px] space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <SummaryRow label="Tạm tính" value={<CurrencyDisplay amount={quote.subtotal} />} />
              <SummaryRow label={`VAT (${quote.taxRate}%)`} value={<CurrencyDisplay amount={quote.taxAmount} />} />
              <SummaryRow
                emphasized
                label="Tổng cộng"
                value={<CurrencyDisplay amount={quote.total} className="text-primary" />}
              />
            </div>
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Điều khoản thanh toán</p>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600">{paymentTerms}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Giao hàng / triển khai</p>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600">{deliveryTerms}</p>
            </div>
          </section>

          <section className="mt-8 flex items-end justify-between gap-8 pt-8">
            <div>
              <Badge variant="neutral">Project: {quote.project.code}</Badge>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                Báo giá do {quote.createdBy.name} lập.
                {quote.createdBy.email ? ` Email liên hệ: ${quote.createdBy.email}.` : ""}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Đại diện AHSO</p>
              <div className="mt-16 border-t border-slate-300 pt-2 text-xs text-slate-600">{quote.createdBy.name}</div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false
}: {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", emphasized ? "pt-2 text-base font-bold" : "")}>
      <span className={emphasized ? "text-slate-900" : "text-slate-600"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
