import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hasPermission, type JwtUser } from "../auth/auth.types";

/** Shared contracts for inventory controls (see docs/INVENTORY_COSTING_SPEC.md §7). */

export const INVENTORY_PERMISSIONS = {
  approve: "inventory.approve",
  viewCost: "inventory.view_cost"
} as const;

/** Setting keys (JSON-stringified values in the Setting table). */
export const INVENTORY_SETTING_KEYS = {
  periodLockedUntil: "inventory.periodLockedUntil",
  manualIssuePriceMode: "inventory.manualIssuePriceMode",
  companyTaxCode: "company.taxCode"
} as const;

export type ManualIssuePriceMode = "IGNORE_WARN" | "BLOCK";
export type CostingMethodValue = "AVERAGE" | "FIFO";

type Db = PrismaClient | Prisma.TransactionClient;

/** True when the user (or machine account mapped to a user) may see unit prices / values. */
export function canViewCost(user: Pick<JwtUser, "permissions" | "role"> | null | undefined) {
  return hasPermission(user, INVENTORY_PERMISSIONS.viewCost);
}

export function assertCanApprove(user: Pick<JwtUser, "permissions" | "role"> | null | undefined) {
  if (!hasPermission(user, INVENTORY_PERMISSIONS.approve)) {
    throw new ForbiddenException("Bạn không có quyền duyệt/xác nhận chứng từ kho");
  }
}

async function readSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return null;
  try {
    const parsed: unknown = JSON.parse(row.value);
    return typeof parsed === "string" ? parsed : parsed == null ? null : String(parsed);
  } catch {
    return row.value;
  }
}

export async function getPeriodLockedUntil(db: Db): Promise<Date | null> {
  const raw = await readSetting(db, INVENTORY_SETTING_KEYS.periodLockedUntil);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Blocks any inventory document whose business date falls on/before the locked period end. */
export async function assertPeriodOpen(db: Db, documentDate: Date, label = "chứng từ") {
  const lockedUntil = await getPeriodLockedUntil(db);
  if (lockedUntil && documentDate.getTime() <= lockedUntil.getTime()) {
    throw new BadRequestException(
      `Kỳ kế toán đã khóa đến ${lockedUntil.toISOString().slice(0, 10)}, không thể tạo/sửa/hủy ${label} trong kỳ này`
    );
  }
}

/** Costing method in force on `asOf` (latest config with effectiveFrom <= asOf), default AVERAGE. */
export async function getCostingMethod(db: Db, asOf: Date = new Date()): Promise<CostingMethodValue> {
  const cfg = await db.inventoryCostingConfig.findFirst({
    where: { effectiveFrom: { lte: asOf } },
    orderBy: { effectiveFrom: "desc" }
  });
  return cfg?.method ?? "AVERAGE";
}

export async function getManualIssuePriceMode(db: Db): Promise<ManualIssuePriceMode> {
  const raw = await readSetting(db, INVENTORY_SETTING_KEYS.manualIssuePriceMode);
  return raw === "BLOCK" ? "BLOCK" : "IGNORE_WARN";
}

/** Company tax code used to recognise AHSO's own sales invoices during intake. */
export async function getCompanyTaxCode(db: Db): Promise<string> {
  return (await readSetting(db, INVENTORY_SETTING_KEYS.companyTaxCode)) ?? "0316896939";
}

/** Strip price/value keys for users without inventory.view_cost. Shallow-recursive on plain objects/arrays. */
const COST_KEYS = new Set([
  "unitPrice", "costPrice", "totalAmount", "totalValue", "amount", "lineTotal", "lotUnitPrice",
  "vatAmount", "vatTotal", "valueAdjustment", "roundingDiff", "invoiceTotalDeclared", "stockValue", "inventoryValue"
]);

export function maskCosts<T>(value: T, visible: boolean): T {
  if (visible) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && !(v instanceof Date) && typeof (v as { toFixed?: unknown }).toFixed !== "function") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = COST_KEYS.has(k) ? null : walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
