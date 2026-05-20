"use client";

import type { Route } from "next";
import Link from "next/link";
import { useStockTransfer, useConfirmStockTransfer, useCancelStockTransfer } from "@/hooks/use-stock-transfers";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STOCK_DOC_STATUS_LABELS, STOCK_DOC_STATUS_COLORS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function StockTransferDetailClient({ transferId }: { transferId: string }) {
  const query = useStockTransfer(transferId);
  const confirmMutation = useConfirmStockTransfer(transferId);
  const cancelMutation = useCancelStockTransfer(transferId);
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
        <PageHeader title="Chi tiết phiếu chuyển kho" description="Không thể tải phiếu chuyển kho." />
        <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">Không tìm thấy phiếu chuyển kho.</div>
      </div>
    );
  }

  const t = query.data;
  const isDraft = t.status === "DRAFT";

  return (
    <div className="space-y-8">
      <PageHeader
        title={t.transferNo}
        description={`Phiếu chuyển kho · ${formatDate(t.date)}`}
        action={
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <>
                <Button
                  variant="primary"
                  disabled={confirmMutation.isPending}
                  onClick={() =>
                    confirmMutation.mutate(undefined, {
                      onSuccess: () => success("Đã xác nhận phiếu chuyển kho."),
                      onError: () => showError("Không thể xác nhận phiếu."),
                    })
                  }
                >
                  Xác nhận
                </Button>
                <Link
                  href={`/inventory/transfers/${transferId}/edit` as Route}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Chỉnh sửa
                </Link>
                <Button
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() =>
                    cancelMutation.mutate(undefined, {
                      onSuccess: () => success("Đã hủy phiếu chuyển kho."),
                      onError: () => showError("Không thể hủy phiếu."),
                    })
                  }
                >
                  Hủy phiếu
                </Button>
              </>
            )}
            <Link href={"/inventory/transfers" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Trạng thái">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${STOCK_DOC_STATUS_COLORS[t.status]}`}>
            {STOCK_DOC_STATUS_LABELS[t.status]}
          </span>
        </InfoCard>
        <InfoCard label="Kho nguồn → Kho đích">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{t.fromWarehouse.name}</span>
            <AppIcon name="arrow-right" className="h-4 w-4 text-text-muted" />
            <span className="font-semibold text-text-primary">{t.toWarehouse.name}</span>
          </div>
        </InfoCard>
        <InfoCard label="Số dòng vật tư">
          <p className="font-heading text-2xl font-bold text-primary">{t.itemCount}</p>
        </InfoCard>
      </div>

      {t.notes ? (
        <div className="rounded-xl bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold">Ghi chú:</span> {t.notes}
        </div>
      ) : null}

      <Card className="border border-white/70">
        <CardHeader className="gap-2">
          <p className="v2-label text-primary-mid">Vật tư</p>
          <CardTitle>Danh mục vật tư chuyển</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  <th className="pb-3 pr-4">Vật tư</th>
                  <th className="pb-3 pr-4">ĐVT</th>
                  <th className="pb-3 text-right">Số lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {t.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold text-text-primary">{item.material.name}</p>
                      <p className="text-xs text-text-muted">{item.material.code}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">{item.material.unit}</td>
                    <td className="py-2.5 text-right font-semibold">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-text-muted">
        Tạo bởi: {t.createdBy.name} · {formatDateTime(t.createdAt)}
        {t.confirmedAt ? ` · Xác nhận: ${formatDateTime(t.confirmedAt)}` : ""}
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
