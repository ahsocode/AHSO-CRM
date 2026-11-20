import type { JwtUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import { canViewCost, getCostingMethod, getPeriodLockedUntil } from "../inventory/inventory-controls";
import { isoDay, REPORT_SCHEMA_VERSION, type ReportMeta } from "./report-contract";

export interface MetaInput {
  /** Date the costing method is resolved for (as-of date, or end of the period). */
  referenceDate: Date;
  asOfDate?: Date;
  period?: { from: Date | null; to: Date | null };
  filters: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

/** Serialises filter values (Dates -> YYYY-MM-DD) and drops undefined so the echo is clean JSON. */
export function serializeFilters(filters: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    out[key] = value instanceof Date ? isoDay(value) : value;
  }
  return out;
}

export async function buildReportMeta(
  prisma: PrismaService,
  user: JwtUser | undefined,
  input: MetaInput
): Promise<ReportMeta> {
  const [costMethod, lockedUntil] = await Promise.all([
    getCostingMethod(prisma, input.referenceDate),
    getPeriodLockedUntil(prisma)
  ]);
  return {
    generatedAt: new Date().toISOString(),
    ...(input.asOfDate ? { asOfDate: isoDay(input.asOfDate) as string } : {}),
    ...(input.period ? { period: { from: isoDay(input.period.from), to: isoDay(input.period.to) } } : {}),
    costMethod,
    periodLockedUntil: isoDay(lockedUntil),
    costVisible: canViewCost(user),
    filters: serializeFilters(input.filters),
    schemaVersion: REPORT_SCHEMA_VERSION,
    ...(input.extra ?? {})
  };
}
