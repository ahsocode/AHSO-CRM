import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
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
}: {
  items: WarehouseListItem[];
  meta?: WarehouseListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader><CardTitle>Danh sách kho</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Danh sách kho</CardTitle></CardHeader>
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
        <CardHeader><CardTitle>Danh sách kho</CardTitle></CardHeader>
        <CardContent>
          <EmptyState title="Chưa có kho nào" description="Thêm kho đầu tiên để quản lý tồn kho." />
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
          <p className="v2-label text-primary">Kho hàng</p>
          <CardTitle>Danh sách kho</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} kho, trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline">Trang trước</Button>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline">Trang sau</Button>
        </div>
      </CardHeader>

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
