import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import type { CostingMethodValue } from "../inventory/inventory-controls";
import { maskCosts } from "../inventory/inventory-controls";
import { invoiceDayEnd } from "../common/utils/invoice-date";

/**
 * Shared contract of every /inventory/reports/* endpoint
 * (docs/INVENTORY_COSTING_SPEC.md §8.1): { meta, data, page }.
 * Reports are strictly read-only.
 */
export const REPORT_SCHEMA_VERSION = "1.0";
export const REPORT_DEFAULT_LIMIT = 100;
export const REPORT_MAX_LIMIT = 500;

export interface ReportMeta {
  generatedAt: string;
  asOfDate?: string;
  period?: { from: string | null; to: string | null };
  costMethod: CostingMethodValue;
  periodLockedUntil: string | null;
  costVisible: boolean;
  filters: Record<string, unknown>;
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  [extra: string]: unknown;
}

export interface ReportPage {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportEnvelope<T> {
  meta: ReportMeta;
  data: T[];
  page: ReportPage;
}

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const optionalString = z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional());
export const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
export const requiredDate = z.preprocess(emptyToUndefined, z.coerce.date());
export const coerceBool = z.preprocess((val) => {
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  return val;
}, z.boolean().optional());

export const reportPaginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(REPORT_MAX_LIMIT).default(REPORT_DEFAULT_LIMIT)
};

export function buildPage(page: number, limit: number, total: number): ReportPage {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function isoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function isoDay(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export function startOfDayUtc(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export { invoiceDayEnd as endOfDayUtc };

/** Money: integer VND number. Quantity: number with at most 3 decimals. No implicit rounding beyond that. */
export function money(value: Decimal.Value | null | undefined): number {
  return new Decimal(value ?? 0).toDecimalPlaces(0).toNumber();
}

export function qty(value: Decimal.Value | null | undefined): number {
  return new Decimal(value ?? 0).toDecimalPlaces(3).toNumber();
}

/**
 * Report-specific money keys on top of the shared maskCosts() key list
 * (unitPrice, costPrice, amount, totalAmount, lotUnitPrice, ... are handled by maskCosts itself).
 */
const REPORT_COST_KEYS = new Set([
  "value", "unitCost", "balanceValue", "openingValue", "closingValue", "totalValue",
  "materialCost", "returnedCost", "netMaterialCost", "directCost", "totalCost",
  "remainingValue", "inValue", "outValue", "replayedTotalValue", "currentTotalValue", "reconciliationDiff"
]);

function maskReportKeys<T>(input: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = REPORT_COST_KEYS.has(k) ? null : walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(input) as T;
}

/** Nulls every cost field when the caller lacks inventory.view_cost (maskCosts + report-specific keys). */
export function maskReport<T>(value: T, costVisible: boolean): T {
  if (costVisible) return value;
  return maskReportKeys(maskCosts(value, false));
}
