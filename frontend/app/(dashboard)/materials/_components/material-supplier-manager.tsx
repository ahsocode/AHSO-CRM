"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useSuppliersSelect } from "@/hooks/use-suppliers";
import { useUpsertMaterialSuppliers } from "@/hooks/use-materials";
import { getApiErrorMessage } from "@/lib/api-client";
import type { MaterialDetail } from "@/lib/types";
import { toast } from "sonner";

interface SupplierRow {
  key: string;
  supplierId: string;
  supplierCode: string;
  costPrice: string;
  leadTimeDays: string;
  isPreferred: boolean;
}

function generateKey() {
  return Math.random().toString(36).slice(2);
}

export function MaterialSupplierManager({
  materialId,
  material,
}: {
  materialId: string;
  material: MaterialDetail;
}) {
  const upsertMutation = useUpsertMaterialSuppliers(materialId);
  const { data: suppliersSelect = [] } = useSuppliersSelect();

  const [rows, setRows] = useState<SupplierRow[]>([]);

  useEffect(() => {
    setRows(
      material.suppliers.map((s) => ({
        key: generateKey(),
        supplierId: s.supplierId,
        supplierCode: s.supplierCode ?? "",
        costPrice: String(s.costPrice),
        leadTimeDays: s.leadTimeDays != null ? String(s.leadTimeDays) : "",
        isPreferred: s.isPreferred,
      }))
    );
  }, [material.suppliers]);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: generateKey(),
        supplierId: "",
        supplierCode: "",
        costPrice: "0",
        leadTimeDays: "",
        isPreferred: false,
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, field: keyof SupplierRow, value: unknown) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  function handleSave() {
    const payload = rows
      .filter((r) => r.supplierId)
      .map((r) => ({
        supplierId: r.supplierId,
        supplierCode: r.supplierCode || undefined,
        costPrice: Number(r.costPrice) || 0,
        leadTimeDays: r.leadTimeDays ? Number(r.leadTimeDays) : undefined,
        isPreferred: r.isPreferred,
      }));

    upsertMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Đã cập nhật danh sách nhà cung cấp.");
      },
      onError: () => {
        toast.error("Không thể cập nhật nhà cung cấp.");
      },
    });
  }

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Supplier Map
        </p>
        <CardTitle>Nhà cung cấp vật tư</CardTitle>
        <p className="mt-2 text-sm text-text-secondary">
          Quản lý danh sách NCC, giá nhập và thời gian giao hàng cho vật tư này.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {rows.length === 0 ? (
          <EmptyState
            title="Chưa có nhà cung cấp"
            description="Thêm NCC để liên kết giá nhập và lead time với vật tư này."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.15em] text-text-secondary">
                  <th className="px-3 py-2">Nhà cung cấp</th>
                  <th className="px-3 py-2">Mã NCC</th>
                  <th className="px-3 py-2">Giá nhập</th>
                  <th className="px-3 py-2">Lead time (ngày)</th>
                  <th className="px-3 py-2">Ưu tiên</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="bg-white/80">
                    <td className="rounded-l-xl px-3 py-2">
                      <Select
                        value={row.supplierId}
                        onChange={(e) => updateRow(row.key, "supplierId", e.target.value)}
                      >
                        <option value="">Chọn NCC</option>
                        {suppliersSelect.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} · {s.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        placeholder="Mã tại NCC"
                        value={row.supplierCode}
                        onChange={(e) => updateRow(row.key, "supplierCode", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={row.costPrice}
                        onChange={(e) => updateRow(row.key, "costPrice", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        placeholder="—"
                        value={row.leadTimeDays}
                        onChange={(e) => updateRow(row.key, "leadTimeDays", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={row.isPreferred}
                          onCheckedChange={(checked) =>
                            updateRow(row.key, "isPreferred", Boolean(checked))
                          }
                        />
                      </div>
                    </td>
                    <td className="rounded-r-xl px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="text-xs text-text-muted hover:text-danger hover:underline"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {upsertMutation.isError ? (
          <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
            {getApiErrorMessage(upsertMutation.error, "Không thể cập nhật nhà cung cấp.")}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={addRow}>
            + Thêm NCC
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={upsertMutation.isPending}
            onClick={handleSave}
          >
            {upsertMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
