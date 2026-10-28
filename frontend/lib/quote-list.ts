import type { QuoteStatus } from "./types";

export const QUOTE_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_QUOTE_PAGE_SIZE = 25;
export const EXPIRING_WITHIN_DAYS = 7;
export const MAX_BULK_DUPLICATE = 20;
export const DELETABLE_QUOTE_STATUSES: QuoteStatus[] = ["DRAFT", "REJECTED"];

export type QuoteKpiKey = "all" | "draft" | "sent" | "expiring";

/** Parse the `pageSize` query value; anything not allow-listed falls back to the default. */
export function parseQuotePageSize(value: string | null | undefined): number {
  const parsed = Number(value);
  return (QUOTE_PAGE_SIZES as readonly number[]).includes(parsed) ? parsed : DEFAULT_QUOTE_PAGE_SIZE;
}

/** Map a KPI card to the filters it sets. "all" clears them. */
export function kpiToFilters(key: QuoteKpiKey): { status: QuoteStatus | ""; expiring: boolean } {
  switch (key) {
    case "draft":
      return { status: "DRAFT", expiring: false };
    case "sent":
      return { status: "SENT", expiring: false };
    case "expiring":
      return { status: "", expiring: true };
    default:
      return { status: "", expiring: false };
  }
}

export function activeKpi(status: QuoteStatus | "", expiring: boolean): QuoteKpiKey | null {
  if (expiring) return status === "" ? "expiring" : null;
  if (status === "") return "all";
  if (status === "DRAFT") return "draft";
  if (status === "SENT") return "sent";
  return null;
}

export function isQuoteDeletable(status: QuoteStatus): boolean {
  return DELETABLE_QUOTE_STATUSES.includes(status);
}

export function partitionDeletable<T extends { status: QuoteStatus }>(quotes: T[]) {
  return {
    deletable: quotes.filter((quote) => isQuoteDeletable(quote.status)),
    skipped: quotes.filter((quote) => !isQuoteDeletable(quote.status))
  };
}

export interface SequentialResult<T> {
  ok: Array<{ item: T }>;
  failed: Array<{ item: T; message: string }>;
}

/** Run `task` one item at a time, reporting progress; a failure never stops the rest. */
export async function runSequential<T>(
  items: T[],
  task: (item: T) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void
): Promise<SequentialResult<T>> {
  const result: SequentialResult<T> = { ok: [], failed: [] };
  for (const [index, item] of items.entries()) {
    try {
      await task(item);
      result.ok.push({ item });
    } catch (error) {
      result.failed.push({ item, message: error instanceof Error ? error.message : "Lỗi không xác định" });
    }
    onProgress?.(index + 1, items.length);
  }
  return result;
}
