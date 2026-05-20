"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteSupplier } from "@/hooks/use-suppliers";
import { formatDate } from "@/lib/format";
import type { SupplierListItem, SupplierListMeta } from "@/lib/types";
import { toast } from "sonner";

export function SupplierTable({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange,
}: {
  items: SupplierListItem[];
  meta?: SupplierListMeta;
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
          <CardTitle>Danh sách nhà cung cấp</CardTitle>
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
          <CardTitle>Danh sách nhà cung cấp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách nhà cung cấp."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Danh sách nhà cung cấp</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Chưa có nhà cung cấp"
            description="Thêm nhà cung cấp mới để bắt đầu quản lý vật tư và đơn hàng."
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
            Supplier Ledger
          </p>
          <CardTitle>Danh sách nhà cung cấp</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} nhà cung cấp, trang {currentPage}/{totalPages}
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
          {items.map((supplier) => (
            <article
              key={supplier.id}
              className="cursor-pointer rounded-2xl border border-border/60 bg-white/80 p-4 hover:bg-primary-bg/40"
              onClick={() => router.push(`/suppliers/${supplier.id}` as Route)}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary">{supplier.name}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{supplier.code}</p>
                </div>
                <Badge variant={supplier.isActive ? "success" : "neutral"}>
                  {supplier.isActive ? "Hoạt động" : "Ngưng"}
                </Badge>
              </div>
              {supplier.phone || supplier.email ? (
                <p className="mt-2 text-sm text-text-secondary">
                  {[supplier.phone, supplier.email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                <th className="px-4 py-2">Mã NCC</th>
                <th className="px-4 py-2">Tên</th>
                <th className="px-4 py-2">MST</th>
                <th className="px-4 py-2">SĐT</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Ngày tạo</th>
                <th className="px-4 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((supplier) => (
                <SupplierRow key={supplier.id} supplier={supplier} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierRow({ supplier }: { supplier: SupplierListItem }) {
  const [confirming, setConfirming] = useState(false);
  const deleteMutation = useDeleteSupplier(supplier.id);

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Đã xóa nhà cung cấp.");
        setConfirming(false);
      },
      onError: () => {
        toast.error("Không thể xóa nhà cung cấp.");
        setConfirming(false);
      },
    });
  }

  return (
    <tr className="bg-white/80 shadow-sm">
      <td className="rounded-l-xl px-4 py-3 text-sm font-mono text-text-secondary">
        {supplier.code}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/suppliers/${supplier.id}` as Route}
          className="font-semibold text-text-primary hover:text-primary"
        >
          {supplier.name}
        </Link>
        {supplier.contactName ? (
          <p className="mt-0.5 text-xs text-text-muted">{supplier.contactName}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">{supplier.taxCode ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-text-secondary">{supplier.phone ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-text-secondary">{supplier.email ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge variant={supplier.isActive ? "success" : "neutral"}>
          {supplier.isActive ? "Hoạt động" : "Ngưng"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(supplier.createdAt)}</td>
      <td className="rounded-r-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/suppliers/${supplier.id}` as Route}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Xem
          </Link>
          <Link
            href={`/suppliers/${supplier.id}/edit` as Route}
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
