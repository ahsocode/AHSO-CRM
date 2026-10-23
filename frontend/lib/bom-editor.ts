// Pure helpers for the BOM spreadsheet editor (rows <-> API lines, totals, validation).

import { z } from "zod";
import { COST_GROUP_ORDER } from "@/lib/constants";
import type { BomDetail, BomLineInput, BomTotals, CostGroup } from "@/types/bom";

export interface EditorRow {
  key: string;
  /** Existing line id (kept so allocations / costs stay linked) */
  id?: string;
  group: CostGroup;
  materialId: string | null;
  materialCode: string | null;
  childBomId: string | null;
  childBomLabel: string | null;
  childTotal: number | null;
  name: string;
  specification: string;
  unit: string;
  quantity: string;
  estUnitCost: string;
  notes: string;
}

let rowCounter = 0;

export function newRowKey(): string {
  rowCounter += 1;
  return `r${rowCounter}-${Date.now().toString(36)}`;
}

export function emptyRow(group: CostGroup = "OTHER"): EditorRow {
  return {
    key: newRowKey(),
    group,
    materialId: null,
    materialCode: null,
    childBomId: null,
    childBomLabel: null,
    childTotal: null,
    name: "",
    specification: "",
    unit: "",
    quantity: "1",
    estUnitCost: "0",
    notes: ""
  };
}

export function rowsFromBom(bom: BomDetail): EditorRow[] {
  return [...bom.lines]
    .sort((a, b) => a.order - b.order)
    .map((line) => ({
      key: newRowKey(),
      id: line.id,
      group: line.group,
      materialId: line.materialId,
      materialCode: line.material?.code ?? null,
      childBomId: line.childBomId,
      childBomLabel: line.childBom ? `${line.childBom.code} · v${line.childBom.version}` : null,
      childTotal: line.childTotal,
      name: line.name,
      specification: line.specification ?? "",
      unit: line.unit ?? "",
      quantity: String(line.quantity),
      estUnitCost: String(line.estUnitCost),
      notes: line.notes ?? ""
    }));
}

export function toNumber(value: string): number {
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rowAmount(row: EditorRow): number {
  const unitCost = row.childBomId && row.childTotal !== null ? row.childTotal : toNumber(row.estUnitCost);
  return Math.round(toNumber(row.quantity) * unitCost);
}

export function isUnlinkedRow(row: EditorRow): boolean {
  return !row.materialId && !row.childBomId;
}

export function computeTotals(rows: EditorRow[]): BomTotals {
  const byGroup = new Map<CostGroup, number>();
  let total = 0;
  for (const row of rows) {
    const amount = rowAmount(row);
    total += amount;
    byGroup.set(row.group, (byGroup.get(row.group) ?? 0) + amount);
  }
  return {
    total,
    byGroup: COST_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
      group,
      amount: byGroup.get(group) ?? 0
    }))
  };
}

function isBlankRow(row: EditorRow): boolean {
  return (
    !row.name.trim() &&
    !row.materialId &&
    !row.childBomId &&
    !row.specification.trim() &&
    !row.notes.trim() &&
    toNumber(row.estUnitCost) === 0
  );
}

const lineSchema = z.object({
  name: z.string().trim().min(1, "tên không được để trống").max(300, "tên quá dài (tối đa 300 ký tự)"),
  quantity: z.number().positive("số lượng phải lớn hơn 0"),
  estUnitCost: z.number().min(0, "đơn giá không được âm")
});

export type BuildLinesResult =
  | { ok: true; lines: BomLineInput[] }
  | { ok: false; errors: string[] };

/** Validates editor rows and converts them to the PUT /boms/:id/lines payload (blank rows are dropped). */
export function buildLineInputs(rows: EditorRow[]): BuildLinesResult {
  const errors: string[] = [];
  const lines: BomLineInput[] = [];
  const used = rows.filter((row) => !isBlankRow(row));
  if (used.length > 1000) {
    return { ok: false, errors: ["BOM tối đa 1000 dòng."] };
  }
  used.forEach((row, index) => {
    const quantity = toNumber(row.quantity);
    const estUnitCost = toNumber(row.estUnitCost);
    const parsed = lineSchema.safeParse({ name: row.name, quantity, estUnitCost });
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => errors.push(`Dòng ${index + 1}: ${issue.message}`));
      return;
    }
    lines.push({
      ...(row.id ? { id: row.id } : {}),
      group: row.group,
      materialId: row.materialId,
      childBomId: row.childBomId,
      name: row.name.trim(),
      specification: row.specification.trim() || null,
      unit: row.unit.trim() || null,
      quantity,
      estUnitCost: row.childBomId ? 0 : estUnitCost,
      notes: row.notes.trim() || null
    });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, lines };
}
