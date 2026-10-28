import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { decimalToNumber, type DecimalLike } from "../common/utils/decimal";

export const QUOTE_TABLE_COLUMN_KEYS = ["index", "name", "description", "quantity", "unitPrice", "total"] as const;
export type QuoteTableColumnKey = (typeof QUOTE_TABLE_COLUMN_KEYS)[number];
export type QuoteTableColumnWidths = Record<QuoteTableColumnKey, number>;

// Surface per-quote failures instead of silently swallowing them — the user
// must know which quotes could not change status (e.g. ACCEPTED quotes).
export function mapBulkMutationResult(
  action: string,
  quotes: Array<{ id: string; quoteNo: string }>,
  results: PromiseSettledResult<unknown>[]
) {
  const errors = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [];
    }
    const quote = quotes[index];
    const reason = result.reason instanceof Error ? result.reason.message : "Không thể xử lý báo giá";
    return [{ id: quote?.id, name: quote?.quoteNo, message: reason }];
  });
  const processedCount = results.length - errors.length;

  if (results.length > 0 && processedCount === 0) {
    throw new BadRequestException("Không xử lý được báo giá nào trong danh sách đã chọn.");
  }

  return {
    action,
    processedCount,
    failedCount: errors.length,
    errors
  };
}

export function isExpiringSoon(
  validUntil: Date | null,
  status: string,
  now: Date,
  expiringSoonBoundary: Date
) {
  if (!validUntil || status === "ACCEPTED" || status === "REJECTED" || status === "EXPIRED") {
    return false;
  }

  return validUntil >= now && validUntil <= expiringSoonBoundary;
}

/**
 * Per-line VAT: `undefined` means "use the quote's default rate"; `null` means KCT
 * (không chịu thuế) and is NOT the same as 0%. Always persist the resolved value.
 */
export function resolveQuoteItemTaxRates<T extends { taxRate?: number | null }>(
  items: T[],
  defaultTaxRate: number
): Array<T & { taxRate: number | null }> {
  return items.map((item) => ({
    ...item,
    taxRate: item.taxRate === undefined ? defaultTaxRate : item.taxRate
  }));
}

export function buildQuoteItemsCreateInput(
  items: Array<{
    name: string;
    description?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    taxRate: number | null;
    bomId?: string | null;
  }>
) {
  return items.map((item, index) => ({
    order: index + 1,
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice),
    taxRate: item.taxRate,
    ...(item.bomId ? { bomId: item.bomId } : {})
  }));
}

export function normalizeQuoteTableColumnWidths(input: unknown): QuoteTableColumnWidths | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const raw = input as Record<string, unknown>;
  const next = QUOTE_TABLE_COLUMN_KEYS.reduce<Partial<QuoteTableColumnWidths>>((result, key) => {
    const value = Number(raw[key]);
    if (Number.isFinite(value) && value > 0) {
      result[key] = Math.round(value * 100) / 100;
    }
    return result;
  }, {});

  return QUOTE_TABLE_COLUMN_KEYS.every((key) => typeof next[key] === "number")
    ? (next as QuoteTableColumnWidths)
    : undefined;
}

export function buildTableColumnWidthsPayload(input: unknown): { tableColumnWidths: QuoteTableColumnWidths } | Record<string, never> {
  const tableColumnWidths = normalizeQuoteTableColumnWidths(input);
  return tableColumnWidths ? { tableColumnWidths } : {};
}

export type TaxBreakdownEntry = {
  /** VAT percent of the group; `null` = KCT (không chịu thuế). */
  rate: number | null;
  base: number;
  tax: number;
};

type TaxGroup = { rate: number | null; base: Decimal };

/**
 * Groups line totals by VAT rate and rounds tax once per group (like an e-invoice),
 * never per line. Group keys compare numerically (8 and 8.00 are the same group);
 * KCT (null) is its own group with zero tax. Sorted by rate desc, KCT last.
 */
function computeGroupedTax(lines: Array<{ lineTotal: DecimalLike; taxRate: DecimalLike }>) {
  const groups = new Map<number | null, TaxGroup>();

  for (const line of lines) {
    const rate = line.taxRate === null || line.taxRate === undefined ? null : new Decimal(line.taxRate).toNumber();
    const group = groups.get(rate) ?? { rate, base: new Decimal(0) };
    group.base = group.base.plus(new Decimal(line.lineTotal ?? 0));
    groups.set(rate, group);
  }

  const breakdown = [...groups.values()]
    .sort((a, b) => {
      if (a.rate === null) return b.rate === null ? 0 : 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate;
    })
    .map((group) => ({
      rate: group.rate,
      base: group.base,
      tax: group.rate === null ? new Decimal(0) : group.base.mul(group.rate).div(100).round()
    }));

  const subtotal = breakdown.reduce((sum, group) => sum.plus(group.base), new Decimal(0));
  const taxAmount = breakdown.reduce((sum, group) => sum.plus(group.tax), new Decimal(0));

  return { subtotal, taxAmount, total: subtotal.plus(taxAmount), breakdown };
}

function toBreakdownNumbers(breakdown: Array<{ rate: number | null; base: Decimal; tax: Decimal }>): TaxBreakdownEntry[] {
  return breakdown.map((group) => ({
    rate: group.rate,
    base: group.base.toNumber(),
    tax: group.tax.toNumber()
  }));
}

/**
 * Source of truth for quote money. `item.taxRate` undefined falls back to
 * `defaultTaxRate` (legacy callers / omitted field); `null` is KCT.
 */
export function buildQuoteTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
    taxRate?: number | null;
  }>,
  defaultTaxRate: number
) {
  const grouped = computeGroupedTax(
    items.map((item) => ({
      lineTotal: Math.round(item.quantity * item.unitPrice),
      taxRate: item.taxRate === undefined ? defaultTaxRate : item.taxRate
    }))
  );

  return {
    subtotal: grouped.subtotal.toNumber(),
    taxAmount: grouped.taxAmount.toNumber(),
    total: grouped.total.toNumber(),
    breakdown: toBreakdownNumbers(grouped.breakdown)
  };
}

/** Breakdown from stored quote items (persisted line totals and resolved rates). */
export function buildStoredQuoteTaxBreakdown(
  items: Array<{ total: Prisma.Decimal; taxRate: Prisma.Decimal | null }>
): TaxBreakdownEntry[] {
  return toBreakdownNumbers(
    computeGroupedTax(items.map((item) => ({ lineTotal: item.total, taxRate: item.taxRate }))).breakdown
  );
}

/** Total (subtotal + grouped VAT) of stored quote items, e.g. the accepted subset or contract scope. */
export function calculateStoredItemsTotal(
  items: Array<{ total: Prisma.Decimal; taxRate: Prisma.Decimal | null }>
) {
  return decimalToNumber(
    computeGroupedTax(items.map((item) => ({ lineTotal: item.total, taxRate: item.taxRate }))).total
  );
}

export function resolveQuoteStatusPayload(
  quote: {
    status: string;
    sentAt: Date | null;
    acceptedAt: Date | null;
  },
  nextStatus: string
) {
  const now = new Date();

  if (nextStatus === "DRAFT") {
    return {
      sentAt: null,
      acceptedAt: null
    };
  }

  if (nextStatus === "SENT") {
    return {
      sentAt: quote.sentAt ?? now,
      acceptedAt: null
    };
  }

  if (nextStatus === "ACCEPTED") {
    return {
      sentAt: quote.sentAt ?? now,
      acceptedAt: quote.acceptedAt ?? now
    };
  }

  return {
    sentAt: quote.sentAt,
    acceptedAt: null
  };
}

export function calculateAcceptedQuoteTotal(
  quoteItems: Array<{
    id: string;
    total: Prisma.Decimal;
    taxRate: Prisma.Decimal | null;
  }>,
  acceptedItemIds: string[],
  fallbackTotal: Prisma.Decimal
) {
  const acceptedIds = new Set(acceptedItemIds);
  const scopedItems = acceptedIds.size > 0
    ? quoteItems.filter((item) => acceptedIds.has(item.id))
    : quoteItems;

  if (scopedItems.length === 0) {
    return decimalToNumber(fallbackTotal);
  }

  return calculateStoredItemsTotal(scopedItems);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short"
  }).format(value);
}
