import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { STOCK_DOC_STATUS_LABELS, STOCK_DOC_STATUS_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { StockIssueListItem, StockIssueListMeta } from "@/lib/types";

export function StockIssueTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
}: {
  items: StockIssueListItem[];
  meta?: StockIssueListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader><CardTitle>Danh sách phiếu xuất kho</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <LoadingSkeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader><CardTitle>Danh sách phiếu xuất kho</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách phiếu xuất kho."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="border border-white/70">
        <CardHeader><CardTitle>Danh sách phiếu xuất kho</CardTitle></CardHeader>
        <CardContent>
          <EmptyState title="Chưa có phiếu xuất kho" description="Tạo phiếu xuất kho để cấp vật tư cho dự án." />
        </CardContent>
      </Card>
    );
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="v2-label text-accent">Phiếu xuất</p>
          <CardTitle>Danh sách phiếu xuất kho</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} phiếu, trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline">Trang trước</Button>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline">Trang sau</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                <th className="px-4 pb-2">Số phiếu</th>
                <th className="px-4 pb-2">Ngày</th>
                <th className="px-4 pb-2">Kho</th>
                <th className="px-4 pb-2">Dự án</th>
                <th className="px-4 pb-2 text-right">Số dòng</th>
                <th className="px-4 pb-2 text-right">Giá trị</th>
                <th className="px-4 pb-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="bg-white/80 shadow-sm hover:bg-primary-bg/40">
                  <td className="rounded-l-xl px-4 py-3">
                    <Link
                      href={`/inventory/issues/${i.id}` as Route}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {i.issueNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(i.date)}</td>
                  <td className="px-4 py-3 text-text-primary">{i.warehouse.name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {i.project ? (
                      <Link href={`/projects/${i.project.id}` as Route} className="hover:text-primary">
                        {i.project.code}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary">{i.itemCount}</td>
                  <td className="px-4 py-3 text-right font-semibold text-text-primary">
                    <CurrencyDisplay amount={i.totalAmount} short />
                  </td>
                  <td className="rounded-r-xl px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STOCK_DOC_STATUS_COLORS[i.status]}`}>
                      {STOCK_DOC_STATUS_LABELS[i.status]}
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
