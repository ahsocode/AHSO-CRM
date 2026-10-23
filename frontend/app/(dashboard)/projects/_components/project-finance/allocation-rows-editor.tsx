"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate, formatVND } from "@/lib/format";
import type { EligibleStockLot } from "@/lib/types";

export interface AllocationRow {
  key: string;
  stockLotId: string;
  quantity: number;
  bomLineId: string | null;
  /** Preserve how the row was added while the user changes lots. */
  source: "saved" | "suggested" | "manual";
  /** Lot data kept for lots that are not in the eligible list (e.g. suggested or already held) */
  snapshot?: EligibleStockLot;
}

let rowCounter = 0;
export function nextRowKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

interface AllocationRowsEditorProps {
  rows: AllocationRow[];
  eligibleLots: EligibleStockLot[];
  lotsLoading: boolean;
  salesInvoiceDate: string;
  canAdd: boolean;
  disabled?: boolean;
  onChange: (rows: AllocationRow[]) => void;
}

export function AllocationRowsEditor({
  rows,
  eligibleLots,
  lotsLoading,
  salesInvoiceDate,
  canAdd,
  disabled,
  onChange
}: AllocationRowsEditorProps) {
  const eligibleById = new Map(eligibleLots.map((lot) => [lot.id, lot]));
  const lotFor = (row: AllocationRow) => eligibleById.get(row.stockLotId) ?? row.snapshot;

  function updateRow(key: string, patch: Partial<AllocationRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg bg-bg-subtle px-4 py-6 text-center text-sm text-text-secondary">
          Chưa có lô vật tư. Dùng &quot;Gợi ý theo BOM&quot; hoặc thêm lô thủ công.
        </div>
      ) : (
        rows.map((row) => {
          const lot = lotFor(row);
          const isLotUnavailable = Boolean(
            row.stockLotId && !lotsLoading &&
            (!lot || lot.purchaseInvoiceDate.slice(0, 10) > salesInvoiceDate ||
              lot.remainingQuantity <= 0)
          );
          const lotInList = eligibleById.has(row.stockLotId);
          return (
            <div
              key={row.key}
              data-testid="allocation-row"
              className="grid gap-3 rounded-lg bg-bg-subtle p-3 lg:grid-cols-[1fr_140px_84px]"
            >
              <Select
                aria-label="Lô nhập"
                value={row.stockLotId}
                disabled={disabled}
                onChange={(event) => {
                  const nextLot = eligibleById.get(event.target.value);
                  updateRow(row.key, {
                    stockLotId: event.target.value,
                    source: "manual",
                    bomLineId: nextLot?.materialId === lot?.materialId ? row.bomLineId : null,
                    snapshot: nextLot,
                    quantity: Math.min(row.quantity || 1, nextLot?.remainingQuantity ?? 1)
                  });
                }}
              >
                <option value="">Chọn lô nhập...</option>
                {!lotInList && row.snapshot ? (
                  <option value={row.snapshot.id}>
                    {row.snapshot.material.code} - {row.snapshot.material.name} | {row.snapshot.warehouse.name} |{" "}
                    {formatDate(row.snapshot.purchaseInvoiceDate)}
                  </option>
                ) : null}
                {eligibleLots.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.material.code} - {option.material.name} | {option.warehouse.name} |{" "}
                    {formatDate(option.purchaseInvoiceDate)} | còn {option.remainingQuantity} {option.material.unit}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={0.001}
                step="0.001"
                max={isLotUnavailable ? undefined : lot?.remainingQuantity}
                disabled={disabled || isLotUnavailable}
                aria-label="Số lượng"
                value={row.quantity || ""}
                onChange={(event) => updateRow(row.key, { quantity: Number(event.target.value) })}
              />
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
              >
                Xóa
              </Button>
              {isLotUnavailable ? (
                <div className="text-xs text-danger lg:col-span-3">
                  Lô này không còn trong danh sách hợp lệ (đã hết tồn hoặc sai ngày) — xóa và chọn lô khác.
                </div>
              ) : lot ? (
                <div className="text-xs text-text-secondary lg:col-span-3">
                  {lot.receipt ? `Phiếu nhập ${lot.receipt.receiptNo}` : "Lô điều chỉnh kiểm kê"}
                  {lot.purchaseInvoiceNo ? ` · HĐ mua ${lot.purchaseInvoiceNo}` : ""}
                  {" · "}
                  {lot.warehouse.name} · Đơn giá {formatVND(lot.unitPrice)}
                  {lot.remainingQuantity !== undefined ? ` · Còn ${lot.remainingQuantity} ${lot.material.unit}` : ""}
                </div>
              ) : null}
            </div>
          );
        })
      )}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !canAdd || lotsLoading}
        onClick={() =>
          onChange([
            ...rows,
            { key: nextRowKey(), stockLotId: "", quantity: 1, bomLineId: null, source: "manual" }
          ])
        }
      >
        Thêm lô vật tư
      </Button>
    </div>
  );
}
