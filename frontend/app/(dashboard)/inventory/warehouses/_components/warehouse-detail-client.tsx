"use client";

import type { Route } from "next";
import Link from "next/link";
import { useWarehouse } from "@/hooks/use-warehouses";
import { useInventoryBalances } from "@/hooks/use-inventory";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WarehouseDetailClient({ warehouseId }: { warehouseId: string }) {
  const warehouseQuery = useWarehouse(warehouseId);
  const balances = useInventoryBalances({ warehouseId, limit: 100 });

  if (warehouseQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (warehouseQuery.isError || !warehouseQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Chi tiết kho" description="Không thể tải thông tin kho." />
        <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">Không tìm thấy kho.</div>
      </div>
    );
  }

  const w = warehouseQuery.data;
  const totalValue = balances.data?.items.reduce((s, b) => s + b.value, 0) ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={w.name}
        description={`Mã kho: ${w.code}`}
        action={
          <div className="flex gap-3">
            <Link href={`/inventory/warehouses/${warehouseId}/edit` as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Chỉnh sửa
            </Link>
            <Link href={"/inventory/warehouses" as Route} className={cn(buttonVariants({ variant: "outline" }))}>
              Về danh sách
            </Link>
          </div>
        }
      />

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Trạng thái">
          <Badge variant={w.isActive ? "success" : "neutral"}>
            {w.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
          </Badge>
        </InfoCard>
        <InfoCard label="Quản lý kho">
          <p className="font-semibold text-text-primary">{w.manager?.name ?? "Chưa gán"}</p>
        </InfoCard>
        <InfoCard label="Địa chỉ">
          <p className="text-sm text-text-secondary">{w.address ?? "Chưa có địa chỉ"}</p>
        </InfoCard>
        <InfoCard label="Tổng giá trị tồn kho">
          <p className="font-heading text-xl font-bold text-primary">{formatVND(totalValue)}</p>
        </InfoCard>
      </div>

      {/* Stock balance table */}
      <Card className="border border-white/70">
        <CardHeader className="gap-2">
          <p className="v2-label text-primary">Tồn kho</p>
          <CardTitle>Danh sách vật tư trong kho</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.isLoading ? (
            <LoadingSkeleton className="h-48 w-full" />
          ) : !balances.data?.items.length ? (
            <p className="py-8 text-center text-sm text-text-secondary">Kho chưa có vật tư nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                    <th className="pb-3 pr-4">Vật tư</th>
                    <th className="pb-3 pr-4 text-right">Tồn</th>
                    <th className="pb-3 pr-4">ĐVT</th>
                    <th className="pb-3 text-right">Giá trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {balances.data.items.map((b) => (
                    <tr key={`${b.warehouseId}-${b.materialId}`} className={b.isLowStock ? "bg-accent-bg/30" : ""}>
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-text-primary">{b.material.name}</p>
                        <p className="text-xs text-text-muted">{b.material.code}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold">
                        <span className={b.isLowStock ? "text-danger" : "text-text-primary"}>
                          {b.quantity}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-text-secondary">{b.material.unit}</td>
                      <td className="py-2.5 text-right text-text-secondary">{formatVND(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
