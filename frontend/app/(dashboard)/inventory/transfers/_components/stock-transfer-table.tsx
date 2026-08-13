import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LedgerHeader } from "@/components/shared/ledger-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { STOCK_DOC_STATUS_LABELS, STOCK_DOC_STATUS_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { AppIcon } from "@/components/shared/app-icon";
import type { StockTransferListItem, StockTransferListMeta } from "@/lib/types";

export function StockTransferTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
  toolbar,
}: {
  items: StockTransferListItem[];
  meta?: StockTransferListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
  toolbar?: ReactNode;
}) {
  const currentPage = meta?.page ?? 1;
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const ledgerHeader = (
    <LedgerHeader
      currentPage={currentPage}
      eyebrow="Chuyển kho"
      metaText={`${meta?.total ?? items.length} phiếu · trang ${currentPage}/${totalPages}`}
      onPageChange={onPageChange}
      title="Danh sách"
      toolbar={toolbar}
      totalPages={totalPages}
    />
  );

  if (isLoading) {
    return (
      <Card className="border border-white/70">
        {ledgerHeader}
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <LoadingSkeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        {ledgerHeader}
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách phiếu chuyển kho."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="border border-white/70">
        {ledgerHeader}
        <CardContent>
          <EmptyState title="Chưa có phiếu chuyển kho" description="Tạo phiếu chuyển kho để điều phối vật tư giữa các kho." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/70">
      {ledgerHeader}
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                <th className="px-4 pb-2">Số phiếu</th>
                <th className="px-4 pb-2">Ngày</th>
                <th className="px-4 pb-2">Kho nguồn → Kho đích</th>
                <th className="px-4 pb-2 text-right">Số dòng</th>
                <th className="px-4 pb-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="bg-white/80 shadow-sm hover:bg-primary-bg/40">
                  <td className="rounded-l-xl px-4 py-3">
                    <Link
                      href={`/inventory/transfers/${t.id}` as Route}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {t.transferNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-text-primary">{t.fromWarehouse.name}</span>
                    <AppIcon name="arrow-right" className="mx-2 inline-block h-3.5 w-3.5 text-text-muted" />
                    <span className="font-semibold text-text-primary">{t.toWarehouse.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">{t.itemCount}</td>
                  <td className="rounded-r-xl px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STOCK_DOC_STATUS_COLORS[t.status]}`}>
                      {STOCK_DOC_STATUS_LABELS[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
