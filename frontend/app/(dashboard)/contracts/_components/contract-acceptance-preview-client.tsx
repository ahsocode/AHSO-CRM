"use client";

import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDownloadContractAcceptancePdf, useContract } from "@/hooks/use-contracts";
import { useCompanyInfo, useLogo } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { resolveAssetUrl } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { cn, downloadBlob } from "@/lib/utils";

const MILESTONE_STATUS_LABELS = {
  PENDING: "Chờ triển khai",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Hoàn tất",
  ACCEPTED: "Đã nghiệm thu"
} as const;

export function ContractAcceptancePreviewClient({ contractId }: { contractId: string }) {
  const contractQuery = useContract(contractId);
  const companyQuery = useCompanyInfo();
  const logoQuery = useLogo();
  const downloadMutation = useDownloadContractAcceptancePdf();
  const { error: showError } = useToast();

  if (contractQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full print:hidden" />
        <LoadingSkeleton className="h-[960px] w-full" />
      </div>
    );
  }

  if (contractQuery.isError || !contractQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Xem trước biên bản nghiệm thu"
          description="Không thể tải dữ liệu để render bản in."
          action={
            <Link href="/contracts" className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(contractQuery.error, "Không thể tải dữ liệu biên bản nghiệm thu.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const contract = contractQuery.data;
  const company = companyQuery.data;
  const logoUrl = resolveAssetUrl(logoQuery.data);
  const brandName = company?.shortName || company?.name || "AHSO";
  const acceptanceDate =
    contract.milestones
      .map((milestone) => milestone.completedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? new Date().toISOString();

  return (
    <div className="space-y-8 print:space-y-0">
      <style>{`@media print { @page { size: A4; margin: 0; } }`}</style>
      <PageHeader
        className="print:hidden"
        title="Xem trước biên bản nghiệm thu"
        description="Rà lại bản PDF biên bản nghiệm thu trước khi tải về hoặc in."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/contracts/${contract.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Về chi tiết
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={downloadMutation.isPending}
              onClick={() => {
                downloadMutation.mutate(contract.id, {
                  onSuccess: ({ blob, filename }) => {
                    downloadBlob(blob, filename);
                  },
                  onError: (downloadError) => {
                    showError(getApiErrorMessage(downloadError, "Không thể tải PDF biên bản nghiệm thu."));
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
                    Acceptance Record
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
            <h1 className="font-heading text-4xl font-extrabold uppercase tracking-[0.14em] text-primary">
              Biên Bản Nghiệm Thu
            </h1>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Hợp đồng: {contract.contractNo} · Dự án: {contract.project.code}
            </p>
            <p className="mt-2 text-xs text-slate-500">Ngày nghiệm thu: {formatDate(acceptanceDate)}</p>
          </section>

          <section className="mt-8 rounded-2xl border-l-4 border-primary bg-slate-50 px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Khách hàng</p>
                <p className="mt-2 font-bold text-primary">{contract.project.customer.name}</p>
                {contract.project.customer.taxCode ? (
                  <p className="mt-1 text-xs text-slate-600">MST: {contract.project.customer.taxCode}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-600">
                  {contract.project.customer.address ?? "Chưa cập nhật địa chỉ"}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Liên hệ chính</p>
                <p className="mt-2 text-xs text-slate-600">
                  {contract.project.customer.primaryContact?.name ?? "Chưa thiết lập"}
                  {contract.project.customer.primaryContact?.title
                    ? ` - ${contract.project.customer.primaryContact.title}`
                    : ""}
                </p>
                {contract.project.customer.primaryContact?.phone ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Điện thoại: {contract.project.customer.primaryContact.phone}
                  </p>
                ) : null}
                {contract.project.customer.primaryContact?.email ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Email: {contract.project.customer.primaryContact.email}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <p className="mt-6 text-xs leading-6 text-slate-600">
            Hai bên tiến hành nghiệm thu khối lượng công việc thuộc hợp đồng{" "}
            <span className="font-semibold text-slate-800">{contract.contractNo}</span> cho dự án{" "}
            <span className="font-semibold text-slate-800">{contract.project.name}</span>. Nội dung thực hiện được tổng hợp
            như sau:
          </p>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <SummaryCard label="Tổng milestone" value={`${contract.stats.milestoneCount}`} />
            <SummaryCard
              label="Hoàn tất / chấp nhận"
              value={`${contract.stats.completedMilestones}`}
            />
            <SummaryCard label="Completion rate" value={`${contract.stats.completionRate}%`} />
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-primary text-left text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  <th className="px-3 py-3">STT</th>
                  <th className="px-3 py-3">Hạng mục</th>
                  <th className="px-3 py-3 text-center">Trạng thái</th>
                  <th className="px-3 py-3 text-center">Hạn</th>
                  <th className="px-3 py-3 text-center">Hoàn tất</th>
                  <th className="px-3 py-3 text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {contract.milestones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-5 text-center text-slate-500">
                      Chưa có milestone nào được ghi nhận cho hợp đồng này.
                    </td>
                  </tr>
                ) : (
                  contract.milestones.map((milestone, index) => (
                    <tr key={milestone.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-3 text-center">{String(index + 1).padStart(2, "0")}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800">{milestone.name}</p>
                        {milestone.description ? <p className="mt-1 text-slate-500">{milestone.description}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-center">{MILESTONE_STATUS_LABELS[milestone.status]}</td>
                      <td className="px-3 py-3 text-center">
                        {milestone.dueDate ? formatDate(milestone.dueDate) : "Chưa có hạn"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {milestone.completedAt ? formatDate(milestone.completedAt) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <CurrencyDisplay amount={milestone.paymentAmount} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Tổng hợp thương mại</p>
              <div className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
                <p>
                  Giá trị hợp đồng: <strong><CurrencyDisplay amount={contract.value} /></strong>
                </p>
                <p>
                  Tổng đã thanh toán: <strong><CurrencyDisplay amount={contract.stats.paidAmount} /></strong>
                </p>
                <p>
                  Còn phải thu: <strong><CurrencyDisplay amount={contract.stats.outstandingAmount} /></strong>
                </p>
                <p>
                  Trạng thái hợp đồng: <strong>{contract.status}</strong>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Thanh toán gần nhất</p>
              <div className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
                {contract.payments.length === 0 ? (
                  <p>Chưa ghi nhận thanh toán nào cho hợp đồng này.</p>
                ) : (
                  contract.payments.slice(0, 4).map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between gap-4">
                      <span>
                        {formatDate(payment.paidAt)} · {payment.method ?? "Chưa ghi nhận"}
                      </span>
                      <strong>
                        <CurrencyDisplay amount={payment.amount} />
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {contract.notes ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Ghi chú hợp đồng</p>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600">{contract.notes}</p>
            </section>
          ) : null}

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <SignatureBox title="Đại diện AHSO" />
            <SignatureBox title="Đại diện khách hàng" />
          </section>
        </article>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-heading text-2xl font-extrabold text-text-primary">{value}</p>
    </div>
  );
}

function SignatureBox({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-20 border-t border-slate-300 pt-2 text-center text-xs text-slate-600">
        Ký, ghi rõ họ tên
      </div>
    </div>
  );
}
