"use client";

import type { Route } from "next";
import Link from "next/link";
import { useStockIssue, useConfirmStockIssue, useCancelStockIssue } from "@/hooks/use-stock-issues";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STOCK_DOC_STATUS_LABELS, STOCK_DOC_STATUS_COLORS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function StockIssueDetailClient({ issueId }: { issueId: string }) {
  const query = useStockIssue(issueId);
  const confirmMutation = useConfirmStockIssue(issueId);
  const cancelMutation = useCancelStockIssue(issueId);
  const { success, error: showError } = useToast();

  if (query.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Chi tiết phiếu xuất kho" description="Không thể tải phiếu xuất kho." />
        <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">Không tìm thấy phiếu xuất kho.</div>
      </div>
    );
  }

  const d = query.data;
  const isDraft = d.status === "DRAFT";

  return (
    <div className="space-y-8">
      <PageHeader
        title={d.issueNo}
        description={`Phiếu xuất kho · ${formatDate(d.date)}`}
        action={
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <>
                <Button
                  variant="primary"
                  disabled={confirmMutation.isPending}
                  onClick={() =>
                    confirmMutation.mutate(undefined, {
                      onSuccess: () => success("Đã xác nhận phiếu xuất kho."),
                      onError: () => showError("Không thể xác nhận phiếu."),
                    })
                  }
                >
                  Xác nhận
                </Button>
                <Link
                  href={`/inventory/issues/${issueId}/edit` as Route}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Chỉnh sửa
                </Link>
                <Button
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() =>
                    cancelMutation.mutate(undefined, {
                      onSuccess: () => success("Đã hủy phiếu xuất kho."),
                      onError: () => showError("Không thể hủy phiếu."),
                    })
                  }
                >
                  Hủy phiếu
                </Button>
              </>
            )}
            <Link href={"/inventory/issues" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Trạng thái">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${STOCK_DOC_STATUS_COLORS[d.status]}`}>
            {STOCK_DOC_STATUS_LABELS[d.status]}
          </span>
        </InfoCard>
        <InfoCard label="Kho xuất">
          <p className="font-semibold text-text-primary">{d.warehouse.name}</p>
        </InfoCard>
        <InfoCard label="Dự án">
          {d.project ? (
            <Link href={`/projects/${d.project.id}` as Route} className="font-semibold text-primary hover:underline">
              {d.project.code}
            </Link>
          ) : (
            <p className="text-text-secondary">Không gắn dự án</p>
          )}
        </InfoCard>
        <InfoCard label="Tổng giá trị">
          <div className="font-heading text-xl font-bold text-accent">
            <CurrencyDisplay amount={d.totalAmount} />
          </div>
        </InfoCard>
      </div>

      {d.reason ? (
        <div className="rounded-xl bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold">Lý do xuất:</span> {d.reason}
        </div>
      ) : null}

      {d.notes ? (
        <div className="rounded-xl bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold">Ghi chú:</span> {d.notes}
        </div>
      ) : null}

      <Card className="border border-white/70">
        <CardHeader className="gap-2">
          <p className="v2-label text-accent">Vật tư</p>
          <CardTitle>Danh mục vật tư xuất</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  <th className="pb-3 pr-4">Vật tư</th>
                  <th className="pb-3 pr-4">ĐVT</th>
                  <th className="pb-3 pr-4 text-right">Số lượng</th>
                  <th className="pb-3 pr-4 text-right">Đơn giá</th>
                  <th className="pb-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {d.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold text-text-primary">{item.material.name}</p>
                      <p className="text-xs text-text-muted">{item.material.code}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">{item.material.unit}</td>
                    <td className="py-2.5 pr-4 text-right">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-right"><CurrencyDisplay amount={item.unitPrice} /></td>
                    <td className="py-2.5 text-right font-semibold"><CurrencyDisplay amount={item.total} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60">
                  <td colSpan={4} className="pt-3 pr-4 text-right text-sm font-semibold text-text-secondary">Tổng cộng</td>
                  <td className="pt-3 text-right font-heading text-lg font-bold text-accent">
                    <CurrencyDisplay amount={d.totalAmount} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-text-muted">
        Tạo bởi: {d.createdBy.name} · {formatDateTime(d.createdAt)}
        {d.confirmedAt ? ` · Xác nhận: ${formatDateTime(d.confirmedAt)}` : ""}
      </div>
    </div>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
