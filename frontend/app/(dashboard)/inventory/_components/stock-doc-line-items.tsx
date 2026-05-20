"use client";

import { useEffect, useState } from "react";
import {
  type Control,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { useMaterialsSelect } from "@/hooks/use-materials";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StockDocMode = "receipt" | "issue" | "transfer" | "count";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyControl = Control<any, any>;

interface StockDocLineItemsProps {
  mode: StockDocMode;
  control: AnyControl;
  setValue: (name: string, value: unknown) => void;
  fieldName: string;
  disabled?: boolean;
}

// ─── Material Combobox ───────────────────────────────────────────────────────

interface MaterialSelectOption {
  id: string;
  name: string;
  unit: string;
  salePrice: number;
  code: string;
}

interface MaterialComboboxProps {
  selectedId: string;
  displayName: string;
  onSelect: (material: MaterialSelectOption) => void;
  disabled?: boolean;
}

function MaterialCombobox({ selectedId, displayName, onSelect, disabled }: MaterialComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: materials, isLoading } = useMaterialsSelect(debouncedSearch || undefined);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          value={displayName}
          readOnly
          disabled={disabled}
          placeholder="Chọn vật tư..."
          className="flex-1 cursor-pointer"
          onClick={() => !disabled && setOpen(true)}
        />
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 px-2"
            onClick={() => setOpen((v) => !v)}
          >
            <AppIcon name="search" className="h-4 w-4" />
          </Button>
        )}
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[280px] rounded-xl border border-border bg-white shadow-lg">
            <div className="p-2">
              <Input
                autoFocus
                placeholder="Tìm mã hoặc tên vật tư..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Đang tải...</p>
              ) : !materials?.length ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Không tìm thấy vật tư phù hợp.</p>
              ) : (
                materials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-primary-bg",
                      selectedId === m.id && "bg-primary-bg font-semibold text-primary"
                    )}
                    onClick={() => {
                      onSelect(m as MaterialSelectOption);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="font-mono text-xs text-text-muted">{(m as MaterialSelectOption).code}</span>
                    <span className="flex-1 text-text-primary">{m.name}</span>
                    <span className="text-xs text-text-secondary">{m.unit}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="outline"
                className="w-full text-sm"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Default empty items per mode ───────────────────────────────────────────

export function createEmptyStockDocItem(mode: StockDocMode) {
  if (mode === "transfer") {
    return { materialId: "", materialName: "", unit: "", quantity: 0 };
  }
  if (mode === "count") {
    return { materialId: "", materialName: "", unit: "", systemQuantity: 0, actualQuantity: 0 };
  }
  // receipt | issue
  return { materialId: "", materialName: "", unit: "", quantity: 0, unitPrice: 0 };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function StockDocLineItems({
  mode,
  control,
  setValue,
  fieldName,
  disabled,
}: StockDocLineItemsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: fieldName });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const watchedItems: any[] = useWatch({ control, name: fieldName }) ?? [];

  const showPrice = mode === "receipt" || mode === "issue";
  const showCount = mode === "count";
  const showTransfer = mode === "transfer";

  return (
    <div className="space-y-4">
      {/* Table header — desktop */}
      <div
        className={cn(
          "hidden gap-2 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary md:grid",
          showPrice && "grid-cols-[2fr_80px_100px_140px_140px_36px]",
          showCount && "grid-cols-[2fr_80px_100px_100px_80px_36px]",
          showTransfer && "grid-cols-[2fr_80px_100px_36px]",
          !showPrice && !showCount && !showTransfer && "grid-cols-[2fr_80px_100px_36px]"
        )}
      >
        <span>Vật tư</span>
        <span>ĐVT</span>
        {showCount ? <span>Tồn HT</span> : <span>Số lượng</span>}
        {showPrice && (
          <>
            <span>Đơn giá</span>
            <span>Thành tiền</span>
          </>
        )}
        {showCount && (
          <>
            <span>Thực tế</span>
            <span>Chênh lệch</span>
          </>
        )}
        <span />
      </div>

      {/* Rows */}
      {fields.map((field, index) => {
        const item = watchedItems[index] ?? {};
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const rowTotal = Math.round(qty * unitPrice);
        const actual = Number(item.actualQuantity) || 0;
        const system = Number(item.systemQuantity) || 0;
        const diff = actual - system;

        return (
          <div
            key={field.id}
            className={cn(
              "grid gap-2 rounded-xl border border-border/60 bg-white p-3",
              "md:items-center",
              showPrice && "md:grid-cols-[2fr_80px_100px_140px_140px_36px]",
              showCount && "md:grid-cols-[2fr_80px_100px_100px_80px_36px]",
              showTransfer && "md:grid-cols-[2fr_80px_100px_36px]",
              !showPrice && !showCount && !showTransfer && "md:grid-cols-[2fr_80px_100px_36px]"
            )}
          >
            {/* Material picker */}
            <div className="min-w-0">
              <span className="mb-1 block text-xs text-text-muted md:hidden">Vật tư</span>
              <MaterialCombobox
                selectedId={item.materialId ?? ""}
                displayName={item.materialName ?? ""}
                disabled={disabled}
                onSelect={(material) => {
                  setValue(`${fieldName}.${index}.materialId`, material.id);
                  setValue(`${fieldName}.${index}.materialName`, material.name);
                  setValue(`${fieldName}.${index}.unit`, material.unit);
                  if (showPrice) {
                    setValue(`${fieldName}.${index}.unitPrice`, material.salePrice);
                  }
                }}
              />
            </div>

            {/* Unit (readonly) */}
            <div>
              <span className="mb-1 block text-xs text-text-muted md:hidden">ĐVT</span>
              <Input
                value={item.unit ?? ""}
                readOnly
                disabled
                placeholder="—"
                className="bg-bg-subtle"
              />
            </div>

            {/* Count: system quantity (readonly) */}
            {showCount ? (
              <>
                <div>
                  <span className="mb-1 block text-xs text-text-muted md:hidden">Tồn hệ thống</span>
                  <Input value={system} readOnly disabled className="bg-bg-subtle" />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-text-muted md:hidden">Số thực tế</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.001"
                    disabled={disabled}
                    {...control.register(`${fieldName}.${index}.actualQuantity`, {
                      setValueAs: (v) => (v === "" ? 0 : Number(v)),
                    })}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-text-muted md:hidden">Chênh lệch</span>
                  <div
                    className={cn(
                      "flex h-9 items-center rounded-md border border-border/40 px-3 text-sm font-semibold",
                      diff > 0
                        ? "border-success/40 bg-success-bg text-success"
                        : diff < 0
                          ? "border-danger/40 bg-danger-bg text-danger"
                          : "bg-bg-subtle text-text-secondary"
                    )}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </div>
                </div>
              </>
            ) : (
              /* Non-count: quantity */
              <div>
                <span className="mb-1 block text-xs text-text-muted md:hidden">Số lượng</span>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  disabled={disabled}
                  {...control.register(`${fieldName}.${index}.quantity`, {
                    setValueAs: (v) => (v === "" ? 0 : Number(v)),
                  })}
                />
              </div>
            )}

            {/* Price fields (receipt/issue only) */}
            {showPrice && (
              <>
                <div>
                  <span className="mb-1 block text-xs text-text-muted md:hidden">Đơn giá</span>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    disabled={disabled}
                    {...control.register(`${fieldName}.${index}.unitPrice`, {
                      setValueAs: (v) => (v === "" ? 0 : Number(v)),
                    })}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs text-text-muted md:hidden">Thành tiền</span>
                  <div className="flex h-9 items-center rounded-md border border-border/40 bg-bg-subtle px-3 text-sm font-semibold text-text-primary">
                    <CurrencyDisplay amount={rowTotal} />
                  </div>
                </div>
              </>
            )}

            {/* Remove button */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || fields.length === 1}
                onClick={() => remove(index)}
                className="h-9 w-9 shrink-0 p-0"
              >
                <AppIcon name="close" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => append(createEmptyStockDocItem(mode))}
        >
          <AppIcon name="plus" className="h-4 w-4" />
          Thêm dòng
        </Button>
      )}
    </div>
  );
}
