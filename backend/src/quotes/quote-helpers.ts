import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { decimalToNumber, sumDecimal } from "../common/utils/decimal";

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

export function buildQuoteItemsCreateInput(
  items: Array<{
    name: string;
    description?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
  }>
) {
  return items.map((item, index) => ({
    order: index + 1,
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: Math.round(item.quantity * item.unitPrice)
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

export function buildQuoteTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
  }>,
  taxRate: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice),
    0
  );
  const taxAmount = Math.round((subtotal * taxRate) / 100);

  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount
  };
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
  }>,
  taxRate: Prisma.Decimal,
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

  const subtotal = sumDecimal(scopedItems.map((item) => item.total));
  const taxAmount = subtotal.mul(taxRate).div(100).round();

  return decimalToNumber(subtotal.plus(taxAmount));
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
