"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteMaterial } from "@/hooks/use-materials";
import { formatDate } from "@/lib/format";
import type { MaterialListItem, MaterialListMeta } from "@/lib/types";
import { toast } from "sonner";

export function MaterialTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
}: {
  items: MaterialListItem[];
  meta?: MaterialListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách vật tư</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader>
          <CardTitle>Danh sách vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách vật tư."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách vật tư</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Chưa có vật tư"
            description="Thêm vật tư đầu tiên để bắt đầu quản lý kho hàng."
          />
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Material Ledger
          </p>
          <CardTitle>Danh sách vật tư</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} vật tư, trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            variant="outline"
          >
            Trang trước
          </Button>
          <Button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            variant="outline"
          >
            Trang sau
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Mobile cards */}
        <div className="grid gap-4 md:hidden">
          {items.map((material) => (
            <article
              key={material.id}
              className="cursor-pointer rounded-2xl border border-border/60 bg-white/80 p-4 hover:bg-primary-bg/40"
              onClick={() => router.push(`/materials/${material.id}` as Route)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary">{material.name}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {material.code} · {material.unit}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={material.isActive ? "success" : "neutral"}>
                    {material.isActive ? "Hoạt động" : "Ngưng"}
                  </Badge>
                  {material.isLowStock ? (
                    <Badge variant="warning">Tồn thấp</Badge>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Tồn: <strong className="text-text-primary">{material.totalStock}</strong>
                </span>
                <span className="text-sm font-semibold text-text-primary">
                  <CurrencyDisplay amount={material.salePrice} short />
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4 py-2">Mã VT</th>
                <th className="px-4 py-2">Tên vật tư</th>
                <th className="px-4 py-2">Đơn vị</th>
                <th className="px-4 py-2">Nhóm</th>
                <th className="px-4 py-2">Giá bán</th>
                <th className="px-4 py-2">Giá nhập</th>
                <th className="px-4 py-2">Tồn kho</th>
                <th className="px-4 py-2">Tình trạng</th>
                <th className="px-4 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((material) => (
                <MaterialRow key={material.id} material={material} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MaterialRow({ material }: { material: MaterialListItem }) {
  const [confirming, setConfirming] = useState(false);
  const deleteMutation = useDeleteMaterial(material.id);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Đã xóa vật tư.");
        setConfirming(false);
      },
      onError: () => {
        toast.error("Không thể xóa vật tư.");
        setConfirming(false);
      },
    });
  }

  return (
    <tr className="bg-white/80 shadow-sm">
      <td className="rounded-l-xl px-4 py-3 text-sm font-mono text-text-secondary">
        {material.code}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/materials/${material.id}` as Route}
          className="font-semibold text-text-primary hover:text-primary"
        >
          {material.name}
        </Link>
        {material.category ? (
          <p className="mt-0.5 text-xs text-text-muted">{material.category.name}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">{material.unit}</td>
      <td className="px-4 py-3 text-sm text-text-secondary">
        {material.category?.name ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-text-primary">
        <CurrencyDisplay amount={material.salePrice} short />
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">
        <CurrencyDisplay amount={material.costPrice} short />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{material.totalStock}</span>
          {material.isLowStock ? (
            <span title="Tồn kho dưới mức tối thiểu" className="text-warning">
              ⚠
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={material.isActive ? "success" : "neutral"}>
          {material.isActive ? "Hoạt động" : "Ngưng"}
        </Badge>
      </td>
      <td className="rounded-r-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/materials/${material.id}` as Route}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Xem
          </Link>
          <Link
            href={`/materials/${material.id}/edit` as Route}
            className="text-xs font-semibold text-text-secondary hover:text-primary hover:underline"
          >
            Sửa
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className={`text-xs font-semibold hover:underline ${
              confirming ? "text-danger" : "text-text-muted hover:text-danger"
            }`}
          >
            {confirming ? "Xác nhận?" : "Xóa"}
          </button>
          {confirming ? (
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-text-muted hover:underline"
            >
              Hủy
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
