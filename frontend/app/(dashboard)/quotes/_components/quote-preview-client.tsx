"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuote } from "@/hooks/use-quotes";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const COMPANY_PROFILE = {
  name: "CÔNG TY CỔ PHẦN CÔNG NGHỆ TỰ ĐỘNG HÓA AHSO",
  address: "Số 123, Đường Công Nghệ, Khu Công Nghiệp Cao, TP. Thủ Đức, TP. HCM",
  contact: "Hotline: (+84) 1900 8888 | Email: contact@ahso.vn",
  website: "Website: www.ahso.vn | MST: 0312345678"
};

export function QuotePreviewClient({ quoteId }: { quoteId: string }) {
  const quoteQuery = useQuote(quoteId);

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

  return (
    <div className="space-y-8 print:space-y-0">
      <PageHeader
        className="print:hidden"
        title="Xem trước bản in"
        description="Canvas A4 để rà lại nội dung thương mại trước khi in hoặc lưu PDF."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/quotes/${quote.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Về chi tiết
            </Link>
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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-heading font-extrabold text-white">
                  A
                </div>
                <div>
                  <p className="font-heading text-2xl font-extrabold tracking-tight text-primary">AHSO CRM</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                    Automation Hub
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-[48%] text-right text-[11px] leading-5 text-slate-600">
              <p className="font-bold text-primary">{COMPANY_PROFILE.name}</p>
              <p>{COMPANY_PROFILE.address}</p>
              <p>{COMPANY_PROFILE.contact}</p>
              <p>{COMPANY_PROFILE.website}</p>
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
              <p className="mt-3 text-xs leading-6 text-slate-600">
                {quote.terms ?? "Điều khoản thanh toán sẽ được thống nhất khi chốt PO/HĐ."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Giao hàng / triển khai</p>
              <p className="mt-3 text-xs leading-6 text-slate-600">
                {quote.deliveryTerms ?? "Tiến độ triển khai sẽ được xác nhận theo survey và lịch điều động kỹ thuật."}
              </p>
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
