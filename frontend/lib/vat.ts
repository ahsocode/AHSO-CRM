/**
 * VAT theo từng dòng báo giá. Bản sao hành vi của `buildQuoteTotals` ở backend
 * (docs/VAT_PER_LINE_SPEC.md): làm tròn theo NHÓM thuế suất, null = KCT (khác 0%).
 */

export type VatRate = number | null;

export interface VatBreakdownGroup {
  rate: VatRate;
  base: number;
  tax: number;
}

export interface VatLineInput {
  quantity: number | string;
  unitPrice: number | string;
  /** undefined = dùng thuế suất mặc định; null = KCT */
  taxRate?: VatRate;
}

export interface QuoteTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
  breakdown: VatBreakdownGroup[];
}

export const VAT_PRESETS: ReadonlyArray<{ value: VatRate; label: string }> = [
  { value: null, label: "KCT" },
  { value: 0, label: "0%" },
  { value: 5, label: "5%" },
  { value: 8, label: "8%" },
  { value: 10, label: "10%" }
];

export function formatVatRate(rate: VatRate | undefined): string {
  if (rate === null || rate === undefined) return "KCT";
  return `${Number(Number(rate).toFixed(2))}%`;
}

/** Nhãn dòng tổng: "VAT 8%" / "Không chịu thuế (KCT)". */
export function formatVatGroupLabel(rate: VatRate, baseText?: string): string {
  const label = rate === null ? "Không chịu thuế (KCT)" : `VAT ${formatVatRate(rate)}`;
  return baseText ? `${label} (trên ${baseText})` : label;
}

/** Chỉ ghi rõ "trên …" khi báo giá có nhiều hơn một nhóm thuế hoặc có dòng KCT. */
export function shouldShowVatBase(breakdown: ReadonlyArray<Pick<VatBreakdownGroup, "rate">>): boolean {
  return breakdown.length > 1 || breakdown.some((group) => group.rate === null);
}

/** Tóm tắt ngắn: "VAT 8% + 10%", "KCT", "VAT 10% + KCT". */
export function summarizeVatBreakdown(breakdown: ReadonlyArray<Pick<VatBreakdownGroup, "rate">> | null | undefined): string {
  if (!breakdown || breakdown.length === 0) return "VAT";
  const rates = breakdown.filter((group) => group.rate !== null).map((group) => formatVatRate(group.rate));
  const hasKct = breakdown.some((group) => group.rate === null);
  if (rates.length === 0) return "KCT";
  return `VAT ${[...rates, ...(hasKct ? ["KCT"] : [])].join(" + ")}`;
}

/** Giá trị <select>: "" = KCT, còn lại là số dạng chuỗi. */
export function vatRateToOptionValue(rate: VatRate | undefined): string {
  return rate === null || rate === undefined ? "" : String(Number(rate));
}

export function optionValueToVatRate(value: string): VatRate {
  return value === "" ? null : Number(value);
}

/** Preset + (nếu có) mức lạ của dữ liệu cũ, để hiển thị đúng. */
export function vatOptionsFor(currentRates: ReadonlyArray<VatRate | undefined>): Array<{ value: VatRate; label: string }> {
  const options = [...VAT_PRESETS];
  for (const rate of currentRates) {
    if (rate === null || rate === undefined || Number.isNaN(Number(rate))) continue;
    if (!options.some((option) => option.value === Number(rate))) {
      options.push({ value: Number(rate), label: formatVatRate(rate) });
    }
  }
  return options;
}

export function computeQuoteTotals(items: ReadonlyArray<VatLineInput>, defaultRate: number): QuoteTotals {
  const groups = new Map<number | "kct", number>();
  for (const item of items) {
    const rate = item.taxRate === undefined ? defaultRate : item.taxRate;
    const key: number | "kct" = rate === null ? "kct" : Number(rate);
    const lineTotal = Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    groups.set(key, (groups.get(key) ?? 0) + lineTotal);
  }

  const breakdown: VatBreakdownGroup[] = [...groups.entries()]
    .map(([key, base]) => {
      const rate: VatRate = key === "kct" ? null : key;
      return { rate, base, tax: rate === null ? 0 : Math.round((base * rate) / 100) };
    })
    .sort((a, b) => {
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate;
    });

  const subtotal = breakdown.reduce((sum, group) => sum + group.base, 0);
  const taxAmount = breakdown.reduce((sum, group) => sum + group.tax, 0);
  return { subtotal, taxAmount, total: subtotal + taxAmount, breakdown };
}
