// Client-side Excel helpers for BOM import / export (exceljs is loaded lazily).

import type { CellValue } from "exceljs";
import { COST_GROUP_LABELS, COST_GROUP_ORDER } from "@/lib/constants";
import { computeTotals, rowAmount, toNumber, type EditorRow } from "@/lib/bom-editor";
import { downloadBlob } from "@/lib/utils";
import type { CostGroup } from "@/types/bom";

export type ImportField =
  | "stt"
  | "code"
  | "name"
  | "specification"
  | "unit"
  | "quantity"
  | "estUnitCost"
  | "group"
  | "notes";

export const IMPORT_FIELDS: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: "stt", label: "STT" },
  { key: "code", label: "Mã vật tư" },
  { key: "name", label: "Tên", required: true },
  { key: "specification", label: "Quy cách" },
  { key: "unit", label: "ĐVT" },
  { key: "quantity", label: "Số lượng" },
  { key: "estUnitCost", label: "Đơn giá" },
  { key: "group", label: "Nhóm" },
  { key: "notes", label: "Ghi chú" }
];

/** Column index per field, -1 = not mapped */
export type ImportMapping = Record<ImportField, number>;

export interface ImportSheet {
  name: string;
  rows: string[][];
}

export interface ImportParsedRow {
  sourceRow: number;
  code: string;
  name: string;
  specification: string;
  unit: string;
  quantity: number;
  estUnitCost: number;
  group: CostGroup;
  notes: string;
}

const MAX_IMPORT_ROWS = 5000;

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

function cellToString(value: CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value && value.result !== undefined) {
      return cellToString(value.result as CellValue);
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("error" in value) return "";
  }
  return "";
}

export async function readImportWorkbook(file: File): Promise<ImportSheet[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    const rowCount = Math.min(sheet.rowCount, MAX_IMPORT_ROWS);
    const colCount = sheet.columnCount;
    for (let r = 1; r <= rowCount; r += 1) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= colCount; c += 1) {
        cells.push(cellToString(row.getCell(c).value));
      }
      rows.push(cells);
    }
    return { name: sheet.name, rows };
  });
}

/** 0-based index of the first row (within the first 20) that has at least 3 filled cells. */
export function guessHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    if (rows[i].filter((cell) => cell.trim() !== "").length >= 3) return i;
  }
  return 0;
}

const HEADER_PATTERNS: Record<ImportField, string[]> = {
  stt: ["stt", "tt", "no", "so tt", "item"],
  code: ["ma", "ma vt", "ma vat tu", "ma hang", "ma so", "part no", "part number", "p/n", "pn", "code", "item code"],
  name: ["ten", "ten vat tu", "ten hang", "ten thiet bi", "mo ta", "description", "noi dung", "name"],
  specification: ["quy cach", "thong so", "thong so ky thuat", "spec", "specification", "model"],
  unit: ["dvt", "don vi", "don vi tinh", "unit", "uom"],
  quantity: ["sl", "so luong", "qty", "quantity"],
  estUnitCost: ["don gia", "gia", "don gia du kien", "gia du kien", "unit price", "price"],
  group: ["nhom", "group", "phan loai", "nhom chi phi"],
  notes: ["ghi chu", "note", "notes", "remark", "remarks"]
};

const GUESS_ORDER: ImportField[] = [
  "code",
  "specification",
  "quantity",
  "estUnitCost",
  "unit",
  "group",
  "notes",
  "stt",
  "name"
];

export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {
    stt: -1,
    code: -1,
    name: -1,
    specification: -1,
    unit: -1,
    quantity: -1,
    estUnitCost: -1,
    group: -1,
    notes: -1
  };
  const normalized = headers.map(normalizeText);
  const used = new Set<number>();

  // Pass 1: exact header match. Pass 2: header contains a (long enough) keyword.
  for (const pass of [1, 2]) {
    for (const field of GUESS_ORDER) {
      if (mapping[field] !== -1) continue;
      const patterns = HEADER_PATTERNS[field];
      const index = normalized.findIndex((header, i) => {
        if (used.has(i) || header === "") return false;
        if (pass === 1) return patterns.includes(header);
        return patterns.some((pattern) => pattern.length >= 4 && header.includes(pattern));
      });
      if (index !== -1) {
        mapping[field] = index;
        used.add(index);
      }
    }
  }
  return mapping;
}

const GROUP_KEYWORDS: Array<{ group: CostGroup; words: string[] }> = [
  { group: "VISION", words: ["camera", "vision", "ong kinh", "lens", "den chieu sang", "cam bien hinh anh"] },
  { group: "SOFTWARE", words: ["phan mem", "software", "license", "ban quyen", "lap trinh"] },
  { group: "LABOR", words: ["nhan cong", "labor", "cong lap dat", "cong lap rap", "lap rap"] },
  { group: "OUTSOURCE", words: ["gia cong", "thue ngoai", "outsource"] },
  { group: "SHIPPING", words: ["van chuyen", "shipping", "giao hang", "freight"] },
  {
    group: "ELECTRICAL",
    words: [
      "dien",
      "electrical",
      "plc",
      "hmi",
      "relay",
      "contactor",
      "mcb",
      "cb",
      "aptomat",
      "bien tan",
      "servo",
      "nguon",
      "cap",
      "tu dien",
      "cam bien",
      "sensor",
      "motor",
      "dong co"
    ]
  },
  {
    group: "MECHANICAL",
    words: [
      "co khi",
      "mechanical",
      "khung",
      "thep",
      "inox",
      "nhom",
      "bang tai",
      "xi lanh",
      "bu long",
      "truc",
      "gia do",
      "vit",
      "tam"
    ]
  }
];

/** Guess a cost group from free text; returns null when nothing matches. */
export function guessGroup(text: string): CostGroup | null {
  const normalized = ` ${normalizeText(text)} `;
  if (normalized.trim() === "") return null;
  for (const { group, words } of GROUP_KEYWORDS) {
    if (words.some((word) => normalized.includes(` ${word} `))) return group;
  }
  // Exact label of a group (e.g. exported file) always wins
  for (const group of COST_GROUP_ORDER) {
    if (normalizeText(COST_GROUP_LABELS[group]) === normalized.trim()) return group;
  }
  return null;
}

function groupFromLabel(text: string): CostGroup | null {
  const normalized = normalizeText(text);
  for (const group of COST_GROUP_ORDER) {
    if (normalizeText(COST_GROUP_LABELS[group]) === normalized || group.toLowerCase() === normalized) return group;
  }
  return null;
}

function parseNumber(text: string): number | null {
  const raw = text.trim().replace(/\s/g, "").replace(/[₫đ]|vnd/gi, "");
  if (raw === "") return null;
  let cleaned = raw;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    cleaned = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    cleaned = raw.replace(/,/g, "");
  } else {
    cleaned = raw.replace(",", ".");
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const TOTAL_ROW_PATTERN = /^(tong|cong|tong cong|total|sum|subtotal|grand total|thanh tien)\b/;

/**
 * Converts raw sheet rows into BOM lines. Skips empty rows and total rows; rows that only carry a
 * name (section headings such as "A. Cơ khí") set the guessed group of the lines that follow.
 */
export function buildImportRows(rows: string[][], headerIndex: number, mapping: ImportMapping): ImportParsedRow[] {
  const result: ImportParsedRow[] = [];
  const cell = (row: string[], field: ImportField): string => {
    const index = mapping[field];
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };
  let sectionGroup: CostGroup | null = null;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.every((value) => value.trim() === "")) continue;

    const name = cell(row, "name");
    const code = cell(row, "code");
    const stt = cell(row, "stt");
    const quantityText = cell(row, "quantity");
    const priceText = cell(row, "estUnitCost");

    const firstText = normalizeText(stt || name || code);
    if (TOTAL_ROW_PATTERN.test(firstText) || TOTAL_ROW_PATTERN.test(normalizeText(name))) continue;

    if (!name && !code) continue;

    const isSectionHeading = !code && quantityText === "" && priceText === "";
    if (isSectionHeading) {
      sectionGroup = guessGroup(name) ?? sectionGroup;
      continue;
    }

    const quantity = parseNumber(quantityText);
    const price = parseNumber(priceText);
    const groupText = cell(row, "group");
    const group =
      (groupText ? groupFromLabel(groupText) ?? guessGroup(groupText) : null) ??
      sectionGroup ??
      guessGroup(`${name} ${cell(row, "specification")}`) ??
      "OTHER";

    result.push({
      sourceRow: i + 1,
      code,
      name: name || code,
      specification: cell(row, "specification"),
      unit: cell(row, "unit"),
      quantity: quantity !== null && quantity > 0 ? quantity : 1,
      estUnitCost: price !== null && price >= 0 ? price : 0,
      group,
      notes: cell(row, "notes")
    });
  }
  return result;
}

export async function exportBomToExcel(
  meta: { code: string; name: string; version: number },
  rows: EditorRow[]
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BOM");
  const headers = [
    "STT",
    "Nhóm",
    "Mã vật tư",
    "Tên",
    "Quy cách",
    "ĐVT",
    "SL",
    "Đơn giá dự kiến",
    "Thành tiền",
    "Ghi chú"
  ];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [6, 22, 18, 40, 30, 8, 10, 18, 18, 30].map((width) => ({ width }));

  rows.forEach((row, index) => {
    const unitCost = row.childBomId && row.childTotal !== null ? row.childTotal : toNumber(row.estUnitCost);
    sheet.addRow([
      index + 1,
      COST_GROUP_LABELS[row.group],
      row.materialCode ?? "",
      row.name,
      row.specification,
      row.unit,
      toNumber(row.quantity),
      unitCost,
      rowAmount(row),
      row.notes
    ]);
  });

  const totals = computeTotals(rows);
  sheet.addRow([]);
  totals.byGroup.forEach((entry) => {
    const line = sheet.addRow(["", "", "", `Tổng ${COST_GROUP_LABELS[entry.group]}`, "", "", "", "", entry.amount, ""]);
    line.font = { italic: true };
  });
  const totalLine = sheet.addRow(["", "", "", "Tổng cộng", "", "", "", "", totals.total, ""]);
  totalLine.font = { bold: true };

  ["H", "I"].forEach((column) => {
    sheet.getColumn(column).numFmt = "#,##0";
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  downloadBlob(blob, `${meta.code}-v${meta.version}.xlsx`);
}
