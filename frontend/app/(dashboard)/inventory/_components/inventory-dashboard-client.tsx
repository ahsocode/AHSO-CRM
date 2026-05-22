"use client";

import type { ComponentProps } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useInventoryBalances, useInventorySummary } from "@/hooks/use-inventory";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatVND } from "@/lib/format";
import { cn, downloadExcelRows } from "@/lib/utils";

type AppIconName = ComponentProps<typeof AppIcon>["name"];

const QUICK_LINKS: Array<{ href: Route; label: string; icon: "plus" | "delete" | "arrow-right" | "check-circle" | "factory"; color: string }> = [
  { href: "/inventory/receipts" as Route, label: "Phiếu nhập kho", icon: "plus", color: "text-success" },
  { href: "/inventory/issues" as Route, label: "Phiếu xuất kho", icon: "delete", color: "text-accent" },
  { href: "/inventory/transfers" as Route, label: "Chuyển kho", icon: "arrow-right", color: "text-primary-mid" },
  { href: "/inventory/counts" as Route, label: "Kiểm kê", icon: "check-circle", color: "text-primary" },
  { href: "/inventory/warehouses" as Route, label: "Danh sách kho", icon: "factory", color: "text-text-secondary" },
];

export function InventoryDashboardClient() {
  const summary = useInventorySummary();
  const lowStock = useInventoryBalances({ lowStockOnly: true, limit: 10 });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Kho hàng"
        description="Tổng quan tồn kho, cảnh báo vật tư thấp và truy cập nhanh vào các nghiệp vụ nhập/xuất/chuyển kho."
        action={
          <Link href={"/inventory/receipts/new" as Route} className={cn(buttonVariants({ variant: "primary" }))}>
            Tạo phiếu nhập kho
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-28" />)
        ) : summary.data ? (
          <>
            <KpiCard
              label="Tổng giá trị tồn"
              value={formatVND(summary.data.totalValue)}
              icon={"analytics" as AppIconName}
              color="text-primary"
            />
            <KpiCard
              label="Cảnh báo tồn thấp"
              value={String(summary.data.lowStockCount)}
              icon={"warning" as AppIconName}
              color="text-accent"
            />
            <KpiCard
              label="Phiếu chờ duyệt"
              value={String(summary.data.draftDocsCount)}
              icon={"description" as AppIconName}
              color="text-primary-mid"
            />
            <KpiCard
              label="Số kho"
              value={String(summary.data.warehouseCount)}
              icon={"factory" as AppIconName}
              color="text-success"
            />
          </>
        ) : null}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-white p-4 text-center text-sm font-semibold text-text-primary transition hover:border-primary/30 hover:bg-primary-bg"
          >
            <AppIcon name={link.icon} className={cn("h-6 w-6", link.color)} />
            {link.label}
          </Link>
        ))}
      </div>

      {/* Low stock table */}
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="v2-label text-accent">Cảnh báo</p>
            <CardTitle>Vật tư tồn thấp</CardTitle>
          </div>
          {(lowStock.data?.items.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={async () => {
                const items = lowStock.data?.items ?? [];
                const rows = items.map((item) => ({
                  "Mã vật tư": item.material.code,
                  "Tên vật tư": item.material.name,
                  "Kho": item.warehouse.name,
                  "Đơn vị": item.material.unit,
                  "Tồn hiện tại": item.quantity,
                  "Tồn tối thiểu": item.material.minStock ?? "",
                  "Giá trị tồn": item.value,
                }));
                await downloadExcelRows("ton-kho-thap.xlsx", rows);
              }}
              className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
            >
              Xuất Excel
            </button>
          )}
        </CardHeader>
        <CardContent>
          {lowStock.isLoading ? (
            <LoadingSkeleton className="h-48 w-full" />
          ) : !lowStock.data?.items.length ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Tất cả vật tư đang ở mức tồn kho an toàn.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                    <th className="pb-3 pr-4">Vật tư</th>
                    <th className="pb-3 pr-4">Kho</th>
                    <th className="pb-3 pr-4 text-right">Tồn hiện tại</th>
                    <th className="pb-3 text-right">Tồn tối thiểu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {lowStock.data.items.map((item) => (
                    <tr key={`${item.warehouseId}-${item.materialId}`}>
                      <td className="py-2.5 pr-4">
                        <p className="font-semibold text-text-primary">{item.material.name}</p>
                        <p className="text-xs text-text-muted">{item.material.code}</p>
                      </td>
                      <td className="py-2.5 pr-4 text-text-secondary">{item.warehouse.name}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-danger">
                        {item.quantity} {item.material.unit}
                      </td>
                      <td className="py-2.5 text-right text-text-secondary">
                        {item.material.minStock ?? "—"} {item.material.unit}
                      </td>
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

function KpiCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: AppIconName;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
          <p className={cn("mt-2 font-heading text-2xl font-bold", color)}>{value}</p>
        </div>
        <div className={cn("rounded-lg bg-bg-subtle p-2", color)}>
          <AppIcon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
