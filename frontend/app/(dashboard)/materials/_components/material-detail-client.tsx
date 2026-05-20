"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMaterial } from "@/hooks/use-materials";
import { MaterialSupplierManager } from "./material-supplier-manager";

type Tab = "info" | "suppliers" | "stock";

export function MaterialDetailClient({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const { data: material, isLoading, isError } = useMaterial(materialId);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-20 w-full rounded-2xl" />
        <LoadingSkeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !material) {
    return (
      <div className="rounded-2xl bg-danger-bg/70 p-6 text-sm text-danger">
        Không thể tải thông tin vật tư.
      </div>
    );
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "info", label: "Thông tin chung" },
    { key: "suppliers", label: "Nhà cung cấp" },
    { key: "stock", label: "Tồn kho theo kho" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={material.name}
        description={`Mã: ${material.code} · Đơn vị: ${material.unit}`}
        action={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push("/materials" as Route)}>
              ← Quay lại
            </Button>
            <Link href={`/materials/${materialId}/edit` as Route}>
              <Button variant="primary">Chỉnh sửa</Button>
            </Link>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-bg-hover p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "bg-white text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "info" && (
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  Thông tin vật tư
                </p>
                <CardTitle>{material.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {material.isLowStock ? (
                  <Badge variant="warning">Tồn thấp</Badge>
                ) : null}
                <Badge variant={material.isActive ? "success" : "neutral"}>
                  {material.isActive ? "Hoạt động" : "Ngưng"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Mã vật tư", value: material.code },
                { label: "Tên vật tư", value: material.name },
                { label: "Đơn vị tính", value: material.unit },
                {
                  label: "Nhóm vật tư",
                  value: material.category?.name ?? "—",
                },
                {
                  label: "Giá bán mặc định",
                  value: <CurrencyDisplay amount={material.salePrice} />,
                },
                {
                  label: "Giá nhập",
                  value: <CurrencyDisplay amount={material.costPrice} />,
                },
                {
                  label: "Tồn kho tổng",
                  value: String(material.totalStock),
                },
                {
                  label: "Tồn tối thiểu",
                  value: material.minStock != null ? String(material.minStock) : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                    {label}
                  </dt>
                  <dd className="text-sm text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>

            {material.description ? (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                  Mô tả
                </p>
                <p className="whitespace-pre-wrap text-sm text-text-secondary">
                  {material.description}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {activeTab === "suppliers" && (
        <MaterialSupplierManager materialId={materialId} material={material} />
      )}

      {activeTab === "stock" && (
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Warehouse Stock
            </p>
            <CardTitle>Tồn kho theo kho</CardTitle>
          </CardHeader>
          <CardContent>
            {material.stockBalances.length === 0 ? (
              <p className="text-sm text-text-secondary">Chưa có dữ liệu tồn kho.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">
                      <th className="px-4 py-2">Kho</th>
                      <th className="px-4 py-2">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {material.stockBalances.map((b) => (
                      <tr key={b.warehouseId} className="bg-white/80">
                        <td className="rounded-l-xl px-4 py-3 text-sm text-text-primary">
                          {b.warehouse.name}
                        </td>
                        <td className="rounded-r-xl px-4 py-3 text-sm font-semibold text-text-primary">
                          {b.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4">
              <Link
                href={`/inventory/balances?materialId=${materialId}` as Route}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Xem tồn chi tiết →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
