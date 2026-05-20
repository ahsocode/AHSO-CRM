"use client";

import type { Route } from "next";
import Link from "next/link";
import { useStockCount, useConfirmStockCount, useCancelStockCount } from "@/hooks/use-stock-counts";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STOCK_DOC_STATUS_LABELS, STOCK_DOC_STATUS_COLORS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function StockCountDetailClient({ countId }: { countId: string }) {
  const query = useStockCount(countId);
  const confirmMutation = useConfirmStockCount(countId);
  const cancelMutation = useCancelStockCount(countId);
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
        <PageHeader title="Chi tiết phiếu kiểm kê" description="Không thể tải phiếu kiểm kê." />
        <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">Không tìm thấy phiếu kiểm kê.</div>
      </div>
    );
  }

  const c = query.data;
  const isDraft = c.status === "DRAFT";

  return (
    <div className="space-y-8">
      <PageHeader
        title={c.countNo}
        description={`Phiếu kiểm kê · ${formatDate(c.date)}`}
        action={
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <>
                <Button
                  variant="primary"
                  disabled={confirmMutation.isPending}
                  onClick={() =>
                    confirmMutation.mutate(undefined, {
                      onSuccess: () => success("Đã xác nhận phiếu kiểm kê."),
                      onError: () => showError("Không thể xác nhận phiếu."),
                    })
                  }
                >
                  Xác nhận
                </Button>
                <Link
                  href={`/inventory/counts/${countId}/edit` as Route}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Chỉnh sửa
                </Link>
                <Button
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() =>
                    cancelMutation.mutate(undefined, {
                      onSuccess: () => success("Đã hủy phiếu kiểm kê."),
                      onError: () => showError("Không thể hủy phiếu."),
                    })
                  }
                >
                  Hủy phiếu
                </Button>
              </>
            )}
            <Link href={"/inventory/counts" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Trạng thái">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${STOCK_DOC_STATUS_COLORS[c.status]}`}>
            {STOCK_DOC_STATUS_LABELS[c.status]}
          </span>
        </InfoCard>
        <InfoCard label="Kho kiểm kê">
          <p className="font-semibold text-text-primary">{c.warehouse.name}</p>
        </InfoCard>
        <InfoCard label="Số dòng kiểm kê">
          <p className="font-heading text-2xl font-bold text-primary">{c.itemCount}</p>
        </InfoCard>
      </div>

      {c.notes ? (
        <div className="rounded-xl bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold">Ghi chú:</span> {c.notes}
        </div>
      ) : null}

      <Card className="border border-white/70">
        <CardHeader className="gap-2">
          <p className="v2-label text-primary">Kết quả kiểm kê</p>
          <CardTitle>Danh sách vật tư đã kiểm kê</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  <th className="pb-3 pr-4">Vật tư</th>
                  <th className="pb-3 pr-4">ĐVT</th>
                  <th className="pb-3 pr-4 text-right">Tồn hệ thống</th>
                  <th className="pb-3 pr-4 text-right">Số thực tế</th>
                  <th className="pb-3 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {c.items.map((item) => {
                  const diff = item.actualQuantity - item.systemQuantity;
                  return (
                    <tr key={item.id} className={diff !== 0 ? "bg-warning-bg/20" : ""}>
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-text-primary">{item.material.name}</p>
                        <p className="text-xs text-text-muted">{item.material.code}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-text-secondary">{item.material.unit}</td>
                      <td className="py-2.5 pr-4 text-right text-text-secondary">{item.systemQuantity}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold">{item.actualQuantity}</td>
                      <td className={`py-2.5 text-right font-semibold ${diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-text-secondary"}`}>
                        {diff > 0 ? "+" : ""}{diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-text-muted">
        Tạo bởi: {c.createdBy.name} · {formatDateTime(c.createdAt)}
        {c.confirmedAt ? ` · Xác nhận: ${formatDateTime(c.confirmedAt)}` : ""}
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
