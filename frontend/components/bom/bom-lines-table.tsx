"use client";

import { memo, useCallback, useRef } from "react";
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { COST_GROUP_LABELS, COST_GROUP_ORDER } from "@/lib/constants";
import { emptyRow, isUnlinkedRow, newRowKey, rowAmount, type EditorRow } from "@/lib/bom-editor";
import { formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MaterialSelectItem } from "@/lib/types";
import type { BomListItem, CostGroup } from "@/types/bom";
import { BomMaterialCell } from "./bom-material-cell";

const ROW_GRID =
  "grid grid-cols-[36px_150px_170px_minmax(220px,1fr)_160px_64px_80px_120px_120px_160px_36px] items-center gap-1.5";

const NUMBER_INPUT_CLASS =
  "h-9 px-2 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

type TextColumn = "name" | "specification" | "unit" | "quantity" | "estUnitCost" | "notes";

function cellId(key: string, column: string) {
  return `bom-${key}-${column}`;
}

function readOnlyClass(readOnly: boolean) {
  return readOnly ? "border-transparent bg-transparent focus:border-transparent focus:ring-0" : "";
}

interface RowProps {
  row: EditorRow;
  index: number;
  isLast: boolean;
  readOnly: boolean;
  onPatch: (key: string, patch: Partial<EditorRow>) => void;
  onEnter: (key: string, column: TextColumn) => void;
  onAction: (key: string, action: "duplicate" | "insert" | "remove" | "up" | "down") => void;
}

const BomLineRow = memo(function BomLineRow({ row, index, isLast, readOnly, onPatch, onEnter, onAction }: RowProps) {
  const unlinked = isUnlinkedRow(row);
  const isChild = Boolean(row.childBomId);

  const textProps = (column: TextColumn, label: string) => ({
    id: cellId(row.key, column),
    "aria-label": `${label} ${index + 1}`,
    readOnly,
    value: row[column],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onPatch(row.key, { [column]: event.target.value }),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      // Enter moves down the same column; it must never submit anything.
      event.preventDefault();
      onEnter(row.key, column);
    }
  });

  return (
    <div
      className={cn("px-2 py-1", unlinked ? "bg-warning-bg/60" : "")}
      data-testid="bom-line-row"
      data-unlinked={unlinked ? "true" : "false"}
    >
      <div className={cn(ROW_GRID, "min-h-[40px]")}>
        <span className="text-sm tabular-nums text-text-secondary">{String(index + 1).padStart(2, "0")}</span>

        <Select
          aria-label={`Nhóm ${index + 1}`}
          disabled={readOnly}
          value={row.group}
          onChange={(event) => onPatch(row.key, { group: event.target.value as CostGroup })}
          className="h-9 px-2 text-xs"
        >
          {COST_GROUP_ORDER.map((group) => (
            <option key={group} value={group}>
              {COST_GROUP_LABELS[group]}
            </option>
          ))}
        </Select>

        <BomMaterialCell
          id={cellId(row.key, "material")}
          materialCode={row.materialCode}
          childLabel={row.childBomLabel}
          readOnly={readOnly}
          onClear={() =>
            onPatch(row.key, {
              materialId: null,
              materialCode: null,
              childBomId: null,
              childBomLabel: null,
              childTotal: null
            })
          }
          onPickMaterial={(material: MaterialSelectItem) =>
            onPatch(row.key, {
              materialId: material.id,
              materialCode: material.code,
              childBomId: null,
              childBomLabel: null,
              childTotal: null,
              name: row.name.trim() ? row.name : material.name,
              unit: row.unit.trim() ? row.unit : material.unit
            })
          }
          onPickChild={(bom: BomListItem) =>
            onPatch(row.key, {
              materialId: null,
              materialCode: null,
              childBomId: bom.id,
              childBomLabel: `${bom.code} · v${bom.version}`,
              childTotal: bom.total,
              name: row.name.trim() ? row.name : (bom.product?.name ?? bom.name),
              unit: row.unit.trim() ? row.unit : (bom.product?.unit ?? "Bộ")
            })
          }
        />

        <Input
          {...textProps("name", "Tên")}
          placeholder="Tên vật tư / hạng mục"
          className={cn("h-9 min-w-0 px-2", readOnlyClass(readOnly))}
        />
        <Input
          {...textProps("specification", "Quy cách")}
          placeholder="Quy cách"
          className={cn("h-9 min-w-0 px-2", readOnlyClass(readOnly))}
        />
        <Input
          {...textProps("unit", "Đơn vị tính")}
          placeholder="Cái"
          className={cn("h-9 px-2", readOnlyClass(readOnly))}
        />
        <Input
          {...textProps("quantity", "Số lượng")}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className={cn(NUMBER_INPUT_CLASS, readOnlyClass(readOnly))}
        />
        <Input
          {...textProps("estUnitCost", "Đơn giá dự kiến")}
          type="number"
          inputMode="decimal"
          min={0}
          step="1"
          readOnly={readOnly || isChild}
          value={isChild && row.childTotal !== null ? String(row.childTotal) : row.estUnitCost}
          title={isChild ? "Đơn giá lấy theo tổng dự kiến của BOM con" : undefined}
          className={cn(NUMBER_INPUT_CLASS, readOnlyClass(readOnly || isChild))}
        />
        <div className="text-right text-sm font-semibold tabular-nums text-text-primary">
          {formatVND(rowAmount(row))}
        </div>
        <Input
          {...textProps("notes", "Ghi chú")}
          placeholder="Ghi chú"
          className={cn("h-9 min-w-0 px-2", readOnlyClass(readOnly))}
        />

        {readOnly ? (
          <span />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="h-8 w-8 px-0" aria-label={`Thao tác dòng ${index + 1}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAction(row.key, "duplicate")}>
                <Copy className="mr-2 h-4 w-4" />
                Nhân bản dòng
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAction(row.key, "insert")}>
                <Plus className="mr-2 h-4 w-4" />
                Chèn dòng phía trên
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => onAction(row.key, "up")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Chuyển lên
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isLast} onSelect={() => onAction(row.key, "down")}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Chuyển xuống
              </DropdownMenuItem>
              <DropdownMenuItem className="text-danger" onSelect={() => onAction(row.key, "remove")}>
                <Trash2 className="mr-2 h-4 w-4" />
                Xóa dòng
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {unlinked && row.name.trim() ? (
        <p className="pl-[44px] text-[11px] text-warning">Chưa gắn mã vật tư</p>
      ) : null}
    </div>
  );
});

export function BomLinesTable({
  rows,
  readOnly,
  onRowsChange
}: {
  rows: EditorRow[];
  readOnly: boolean;
  onRowsChange: (updater: (rows: EditorRow[]) => EditorRow[]) => void;
}) {
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const focusLater = useCallback((key: string, column: TextColumn) => {
    // Wait for React to render a freshly added row before moving focus into it
    window.setTimeout(() => document.getElementById(cellId(key, column))?.focus(), 30);
  }, []);

  const handlePatch = useCallback(
    (key: string, patch: Partial<EditorRow>) => {
      onRowsChange((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    },
    [onRowsChange]
  );

  const handleEnter = useCallback(
    (key: string, column: TextColumn) => {
      const current = rowsRef.current;
      const index = current.findIndex((row) => row.key === key);
      if (index === -1) return;
      const next = current[index + 1];
      if (next) {
        document.getElementById(cellId(next.key, column))?.focus();
        return;
      }
      if (readOnly) return;
      const created = emptyRow(current[index].group);
      onRowsChange((existing) => [...existing, created]);
      focusLater(created.key, "name");
    },
    [focusLater, onRowsChange, readOnly]
  );

  const handleAction = useCallback(
    (key: string, action: "duplicate" | "insert" | "remove" | "up" | "down") => {
      onRowsChange((current) => {
        const index = current.findIndex((row) => row.key === key);
        if (index === -1) return current;
        const next = [...current];
        if (action === "remove") {
          next.splice(index, 1);
        } else if (action === "duplicate") {
          const copy: EditorRow = { ...current[index], key: newRowKey() };
          delete copy.id;
          next.splice(index + 1, 0, copy);
        } else if (action === "insert") {
          next.splice(index, 0, emptyRow(current[index].group));
        } else if (action === "up" && index > 0) {
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
        } else if (action === "down" && index < current.length - 1) {
          [next[index + 1], next[index]] = [next[index], next[index + 1]];
        }
        return next;
      });
    },
    [onRowsChange]
  );

  function appendRow() {
    const created = emptyRow(rows[rows.length - 1]?.group ?? "MECHANICAL");
    onRowsChange((current) => [...current, created]);
    focusLater(created.key, "name");
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[1380px]">
          <div
            className={cn(
              ROW_GRID,
              "rounded-md bg-bg-subtle px-2 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
            )}
          >
            <span>STT</span>
            <span>Nhóm</span>
            <span>Mã vật tư</span>
            <span>Tên</span>
            <span>Quy cách</span>
            <span>ĐVT</span>
            <span className="text-right">SL</span>
            <span className="text-right">Đơn giá</span>
            <span className="text-right">Thành tiền</span>
            <span>Ghi chú</span>
            <span />
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-secondary">
              BOM chưa có dòng nào. {readOnly ? "" : "Thêm dòng hoặc nhập từ Excel."}
            </p>
          ) : (
            rows.map((row, index) => (
              <BomLineRow
                key={row.key}
                row={row}
                index={index}
                isLast={index === rows.length - 1}
                readOnly={readOnly}
                onPatch={handlePatch}
                onEnter={handleEnter}
                onAction={handleAction}
              />
            ))
          )}
        </div>
      </div>
      {readOnly ? null : (
        <Button type="button" variant="outline" onClick={appendRow}>
          <Plus className="h-4 w-4" />
          Thêm dòng
        </Button>
      )}
    </div>
  );
}
