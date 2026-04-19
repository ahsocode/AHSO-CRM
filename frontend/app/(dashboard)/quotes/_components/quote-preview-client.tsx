"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDownloadQuotePdf, useQuote } from "@/hooks/use-quotes";
import { useCompanyInfo, useLogo, usePolicies } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn, downloadBlob } from "@/lib/utils";

export function QuotePreviewClient({ quoteId }: { quoteId: string }) {
  const quoteQuery = useQuote(quoteId);
  const companyQuery = useCompanyInfo();
  const policiesQuery = usePolicies();
  const logoQuery = useLogo();
  const downloadMutation = useDownloadQuotePdf();
  const { error: showError } = useToast();

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

  return (
    <div className="space-y-8 print:space-y-0">
      <PageHeader
        className="print:hidden"
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
              disabled={downloadMutation.isPending}
              onClick={() => {
                downloadMutation.mutate(quote.id, {
                  onSuccess: ({ blob, filename }) => {
                    downloadBlob(blob, filename);
                  },
                  onError: (downloadError) => {
                    showError(getApiErrorMessage(downloadError, "Không thể tải PDF báo giá."));
                  }
                });
              }}
            >
              {downloadMutation.isPending ? "Đang tạo PDF..." : "Tải PDF"}
            </Button>
            <Button onClick={() => window.print()} type="button">
              In / Lưu PDF
            </Button>
          </div>
        }
      />

      <div className="rounded-[28px] bg-slate-300/25 p-4 md:p-8 print:bg-transparent print:p-0">
        <article className="mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-white p-[14mm] text-sm text-slate-800 shadow-2xl print:min-h-0 print:max-w-none print:shadow-none">
          <header className="flex items-start justify-between gap-8">
            <div className="max-w-[46%]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {logoUrl ? (
                    <img src={logoUrl} alt={brandName} className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="font-heading text-xl font-extrabold text-primary">A</span>
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

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-primary text-left text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  <th className="px-3 py-3">STT</th>
                  <th className="px-3 py-3">Hạng mục / Quy cách</th>
                  <th className="px-3 py-3 text-center">ĐVT</th>
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
                      {item.description ? <p className="mt-1 text-slate-500">{item.description}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-center">{item.unit ?? "Đơn vị"}</td>
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
