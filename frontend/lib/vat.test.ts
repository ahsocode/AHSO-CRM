import { describe, expect, it } from "vitest";
import {
  computeQuoteTotals,
  formatVatGroupLabel,
  formatVatRate,
  summarizeVatBreakdown,
  vatOptionsFor,
  VAT_PRESETS
} from "./vat";

describe("vat", () => {
  it("formats rates", () => {
    expect(formatVatRate(null)).toBe("KCT");
    expect(formatVatRate(0)).toBe("0%");
    expect(formatVatRate(8)).toBe("8%");
    expect(formatVatRate(8.0)).toBe("8%");
    expect(formatVatRate(7.5)).toBe("7.5%");
    expect(formatVatGroupLabel(null)).toBe("Không chịu thuế (KCT)");
    expect(formatVatGroupLabel(10)).toBe("VAT 10%");
    expect(VAT_PRESETS.map((p) => p.value)).toEqual([null, 0, 5, 8, 10]);
  });

  it("mixed rates: 8% and 10% groups, sorted rate desc", () => {
    // 1000000 @8% -> 80000 ; 2 x 500000 = 1000000 @10% -> 100000
    const totals = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 1_000_000, taxRate: 8 },
        { quantity: 2, unitPrice: 500_000, taxRate: 10 }
      ],
      10
    );
    expect(totals.breakdown).toEqual([
      { rate: 10, base: 1_000_000, tax: 100_000 },
      { rate: 8, base: 1_000_000, tax: 80_000 }
    ]);
    expect(totals.subtotal).toBe(2_000_000);
    expect(totals.taxAmount).toBe(180_000);
    expect(totals.total).toBe(2_180_000);
  });

  it("KCT (null) is separate from 0% and sorted last", () => {
    const totals = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 100, taxRate: null },
        { quantity: 1, unitPrice: 200, taxRate: 0 },
        { quantity: 1, unitPrice: 300, taxRate: 10 }
      ],
      10
    );
    expect(totals.breakdown).toEqual([
      { rate: 10, base: 300, tax: 30 },
      { rate: 0, base: 200, tax: 0 },
      { rate: null, base: 100, tax: 0 }
    ]);
    expect(totals.total).toBe(630);
    expect(summarizeVatBreakdown(totals.breakdown)).toBe("VAT 10% + 0% + KCT");
  });

  it("rounds per group, not per line", () => {
    // Three lines of 5 @10%: per-line = 3 x round(0.5)=3 x 1 = 3 ; per-group = round(15*0.1)=round(1.5)=2
    const totals = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 5, taxRate: 10 },
        { quantity: 1, unitPrice: 5, taxRate: 10 },
        { quantity: 1, unitPrice: 5, taxRate: 10 }
      ],
      10
    );
    expect(totals.breakdown).toEqual([{ rate: 10, base: 15, tax: 2 }]);
    expect(totals.taxAmount).toBe(2);
    expect(totals.total).toBe(17);
  });

  it("undefined taxRate uses default; null does not; 8 and 8.00 share a group", () => {
    const totals = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 1000 },
        { quantity: 1, unitPrice: 1000, taxRate: 8 },
        { quantity: 1, unitPrice: 1000, taxRate: 8.0 },
        { quantity: 1, unitPrice: 1000, taxRate: null }
      ],
      8
    );
    expect(totals.breakdown).toEqual([
      { rate: 8, base: 3000, tax: 240 },
      { rate: null, base: 1000, tax: 0 }
    ]);
    expect(summarizeVatBreakdown(totals.breakdown)).toBe("VAT 8% + KCT");
    expect(summarizeVatBreakdown([{ rate: null }])).toBe("KCT");
    expect(summarizeVatBreakdown([{ rate: 8 }, { rate: 10 }])).toBe("VAT 8% + 10%");
  });

  it("rounds line total and handles empty input", () => {
    expect(computeQuoteTotals([{ quantity: 1.5, unitPrice: 333, taxRate: 10 }], 10).breakdown).toEqual([
      { rate: 10, base: 500, tax: 50 }
    ]);
    expect(computeQuoteTotals([], 10)).toEqual({ subtotal: 0, taxAmount: 0, total: 0, breakdown: [] });
  });

  it("adds legacy rates as extra option", () => {
    expect(vatOptionsFor([10, 7, null]).map((o) => o.label)).toEqual(["KCT", "0%", "5%", "8%", "10%", "7%"]);
  });
});
