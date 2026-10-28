/**
 * Per-line VAT breakdown for printed documents (see docs/VAT_PER_LINE_SPEC.md).
 * Pure helper: groups quote items by numeric tax rate (null = KCT), rounds tax per group.
 */
export interface TaxBreakdownItemInput {
  quantity: unknown;
  unitPrice: unknown;
  /** undefined = not set (falls back to defaultRate); null = KCT (non-taxable). */
  taxRate?: unknown;
}

export interface QuoteTaxBreakdownGroup {
  rate: number | null;
  base: number;
  tax: number;
  /** "8%" (decimals trimmed) or "KCT". */
  rateLabel: string;
  isKct: boolean;
  /** true when the printed VAT rows must state the base ("trên …"): >1 group or any KCT group. */
  showBase: boolean;
}

/** Base text is shown only when the quote has more than one tax group or any KCT group. */
export function shouldShowTaxBase(groups: ReadonlyArray<{ rate?: unknown }>): boolean {
  return groups.length > 1 || groups.some((g) => g.rate === null || g.rate === undefined);
}

function toFiniteNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveRate(raw: unknown, defaultRate: unknown): number | null {
  const value = raw === undefined ? defaultRate : raw;
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatTaxRateLabel(rate: number | null): string {
  if (rate === null) return "KCT";
  return `${Number(rate.toFixed(2))}%`;
}

export function buildQuoteTaxBreakdown(
  items: ReadonlyArray<TaxBreakdownItemInput>,
  defaultRate?: unknown
): QuoteTaxBreakdownGroup[] {
  const bases = new Map<number | null, number>();
  for (const item of items) {
    const rate = resolveRate(item.taxRate, defaultRate);
    const lineTotal = Math.round(toFiniteNumber(item.quantity) * toFiniteNumber(item.unitPrice));
    bases.set(rate, (bases.get(rate) ?? 0) + lineTotal);
  }

  const groups = [...bases.entries()]
    .map(([rate, base]) => ({
      rate,
      base,
      tax: rate === null ? 0 : Math.round((base * rate) / 100),
      rateLabel: formatTaxRateLabel(rate),
      isKct: rate === null,
      showBase: false
    }))
    .sort((a, b) => {
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate;
    });
  const showBase = shouldShowTaxBase(groups);
  return groups.map((g) => ({ ...g, showBase }));
}
