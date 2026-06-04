"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStockReceipt, useConfirmStockReceipt, useCancelStockReceipt } from "@/hooks/use-stock-receipts";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STOCK_DOC_STATUS_LABELS, STOCK_DOC_STATUS_COLORS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function StockReceiptDetailClient({ receiptId }: { receiptId: string }) {
  const query = useStockReceipt(receiptId);
  const confirmMutation = useConfirmStockReceipt(receiptId);
  const cancelMutation = useCancelStockReceipt(receiptId);
  const { success, error: showError } = useToast();
  const router = useRouter();

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
        <PageHeader title="Chi tiết phiếu nhập kho" description="Không thể tải phiếu nhập kho." />
        <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">Không tìm thấy phiếu nhập kho.</div>
      </div>
    );
  }

  const r = query.data;
  const isDraft = r.status === "DRAFT";

  return (
    <div className="space-y-8">
      <PageHeader
        title={r.receiptNo}
        description={`Phiếu nhập kho · ${formatDate(r.date)}`}
        action={
          <div className="flex flex-wrap gap-3">
            {isDraft && (
              <>
                <Button
                  variant="primary"
                  disabled={confirmMutation.isPending}
                  onClick={() =>
                    confirmMutation.mutate(undefined, {
                      onSuccess: () => success("Đã xác nhận phiếu nhập kho."),
                      onError: () => showError("Không thể xác nhận phiếu."),
                    })
                  }
                >
                  Xác nhận
                </Button>
                <Link
                  href={`/inventory/receipts/${receiptId}/edit` as Route}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  Chỉnh sửa
                </Link>
                <Button
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() =>
                    cancelMutation.mutate(undefined, {
                      onSuccess: () => success("Đã hủy phiếu nhập kho."),
                      onError: () => showError("Không thể hủy phiếu."),
                    })
                  }
                >
                  Hủy phiếu
                </Button>
              </>
            )}
            <Link href={"/inventory/receipts" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Trạng thái">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${STOCK_DOC_STATUS_COLORS[r.status]}`}>
            {STOCK_DOC_STATUS_LABELS[r.status]}
          </span>
        </InfoCard>
        <InfoCard label="Kho nhập">
          <p className="font-semibold text-text-primary">{r.warehouse.name}</p>
        </InfoCard>
        <InfoCard label="Nhà cung cấp">
          <p className="text-text-secondary">{r.supplier?.name ?? "Không xác định"}</p>
        </InfoCard>
        <InfoCard label="Số hóa đơn mua">
          <p className="text-text-secondary">{r.purchaseInvoiceNo ?? "Chưa ghi nhận"}</p>
        </InfoCard>
        <InfoCard label="Tổng giá trị">
          <div className="font-heading text-xl font-bold text-primary">
            <CurrencyDisplay amount={r.totalAmount} />
          </div>
        </InfoCard>
      </div>

      {r.notes ? (
        <div className="rounded-xl bg-bg-subtle px-4 py-3 text-sm text-text-secondary">
          <span className="font-semibold">Ghi chú:</span> {r.notes}
        </div>
      ) : null}

      <Card className="border border-white/70">
        <CardHeader className="gap-2">
          <p className="v2-label text-primary">Vật tư</p>
          <CardTitle>Danh mục vật tư nhập</CardTitle>
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
                {r.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold text-text-primary">{item.material.name}</p>
                      <p className="text-xs text-text-muted">{item.material.code}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">{item.material.unit}</td>
                    <td className="py-2.5 pr-4 text-right">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <CurrencyDisplay amount={item.unitPrice} />
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      <CurrencyDisplay amount={item.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60">
                  <td colSpan={4} className="pt-3 pr-4 text-right text-sm font-semibold text-text-secondary">Tổng cộng</td>
                  <td className="pt-3 text-right font-heading text-lg font-bold text-primary">
                    <CurrencyDisplay amount={r.totalAmount} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-text-muted">
        Tạo bởi: {r.createdBy.name} · {formatDateTime(r.createdAt)}
        {r.confirmedAt ? ` · Xác nhận: ${formatDateTime(r.confirmedAt)}` : ""}
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
