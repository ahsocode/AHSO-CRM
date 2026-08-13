import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LedgerHeader } from "@/components/shared/ledger-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import type { WarehouseListItem } from "@/lib/types";
import type { WarehouseListMeta } from "@/hooks/use-warehouses";

export function WarehouseTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
  toolbar,
}: {
  items: WarehouseListItem[];
  meta?: WarehouseListMeta;
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
      eyebrow="Kho hàng"
      metaText={`${meta?.total ?? items.length} kho · trang ${currentPage}/${totalPages}`}
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
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-14 w-full" />
          ))}
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
            {errorMessage ?? "Không thể tải danh sách kho."}
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
          <EmptyState title="Chưa có kho nào" description="Thêm kho đầu tiên để quản lý tồn kho." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/70">
      {ledgerHeader}

      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                <th className="px-4 pb-2">Mã kho</th>
                <th className="px-4 pb-2">Tên kho</th>
                <th className="px-4 pb-2">Địa chỉ</th>
                <th className="px-4 pb-2">Quản lý kho</th>
                <th className="px-4 pb-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="bg-white/80 shadow-sm hover:bg-primary-bg/40">
                  <td className="rounded-l-xl px-4 py-3">
                    <Link
                      href={`/inventory/warehouses/${w.id}` as Route}
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {w.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                    <Link href={`/inventory/warehouses/${w.id}` as Route} className="hover:text-primary">
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{w.address ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{w.manager?.name ?? "—"}</td>
                  <td className="rounded-r-xl px-4 py-3">
                    <Badge variant={w.isActive ? "success" : "neutral"}>
                      {w.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                    </Badge>
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
