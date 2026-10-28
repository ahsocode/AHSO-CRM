import { Prisma } from "@prisma/client";
import {
  buildQuoteItemsCreateInput,
  buildQuoteTotals,
  buildStoredQuoteTaxBreakdown,
  calculateAcceptedQuoteTotal,
  resolveQuoteItemTaxRates
} from "./quote-helpers";

const dec = (value: number | string) => new Prisma.Decimal(value);

describe("buildQuoteTotals (per-line VAT)", () => {
  it("groups mixed 8% / 10% / KCT / 0% lines with hand-computed totals", () => {
    // 10%: 2_500_010 -> 250_001 | 8%: 999_999 + 1_000_001 -> 160_000 | 0%: 700_000 | KCT: 500_000
    const result = buildQuoteTotals(
      [
        { quantity: 3, unitPrice: 333_333, taxRate: 8 },
        { quantity: 2, unitPrice: 1_250_005, taxRate: 10 },
        { quantity: 1, unitPrice: 500_000, taxRate: null },
        { quantity: 1, unitPrice: 700_000, taxRate: 0 },
        { quantity: 1, unitPrice: 1_000_001, taxRate: 8.0 }
      ],
      10
    );

    expect(result).toEqual({
      subtotal: 5_700_010,
      taxAmount: 410_001,
      total: 6_110_011,
      breakdown: [
        { rate: 10, base: 2_500_010, tax: 250_001 },
        { rate: 8, base: 2_000_000, tax: 160_000 },
        { rate: 0, base: 700_000, tax: 0 },
        { rate: null, base: 500_000, tax: 0 }
      ]
    });
  });

  it("keeps KCT (null) and 0% as distinct groups and never taxes either", () => {
    const result = buildQuoteTotals(
      [
        { quantity: 1, unitPrice: 100, taxRate: null },
        { quantity: 1, unitPrice: 200, taxRate: 0 }
      ],
      10
    );

    expect(result.breakdown).toEqual([
      { rate: 0, base: 200, tax: 0 },
      { rate: null, base: 100, tax: 0 }
    ]);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(300);
  });

  it("rounds tax once per group, not per line", () => {
    // Per line: 1_006 * 8% = 80.48 -> 80, twice = 160. Per group: 2_012 * 8% = 160.96 -> 161.
    const result = buildQuoteTotals(
      [
        { quantity: 1, unitPrice: 1_006, taxRate: 8 },
        { quantity: 1, unitPrice: 1_006, taxRate: 8 }
      ],
      10
    );

    expect(result.taxAmount).toBe(161);
    expect(result.total).toBe(2_173);
    expect(result.breakdown).toEqual([{ rate: 8, base: 2_012, tax: 161 }]);
  });

  it("rounds a .5 group tax half-up", () => {
    // 5 * 10% = 0.5 -> 1; 1_010 * 5% = 50.5 -> 51
    expect(buildQuoteTotals([{ quantity: 1, unitPrice: 5, taxRate: 10 }], 0).taxAmount).toBe(1);
    expect(buildQuoteTotals([{ quantity: 1, unitPrice: 1_010, taxRate: 5 }], 0).taxAmount).toBe(51);
  });

  it("supports a fractional legacy rate exactly (no float drift)", () => {
    // 1_000 * 8.1% = 81 exactly; 333 * 8.25% = 27.4725 -> 27
    expect(buildQuoteTotals([{ quantity: 1, unitPrice: 1_000, taxRate: 8.1 }], 0).taxAmount).toBe(81);
    expect(buildQuoteTotals([{ quantity: 1, unitPrice: 333, taxRate: 8.25 }], 0).taxAmount).toBe(27);
  });

  it("falls back to the quote default only when the line rate is omitted (legacy callers)", () => {
    expect(
      buildQuoteTotals(
        [
          { quantity: 2, unitPrice: 100 },
          { quantity: 1, unitPrice: 50 }
        ],
        10
      )
    ).toEqual({ subtotal: 250, taxAmount: 25, total: 275, breakdown: [{ rate: 10, base: 250, tax: 25 }] });

    // null is KCT, not "use default"
    expect(buildQuoteTotals([{ quantity: 1, unitPrice: 100, taxRate: null }], 10).taxAmount).toBe(0);
  });
});

describe("resolveQuoteItemTaxRates / buildQuoteItemsCreateInput", () => {
  it("resolves undefined to the default and keeps null and 0 as given", () => {
    const resolved = resolveQuoteItemTaxRates(
      [
        { name: "a", quantity: 1, unitPrice: 1 },
        { name: "b", quantity: 1, unitPrice: 1, taxRate: null },
        { name: "c", quantity: 1, unitPrice: 1, taxRate: 0 },
        { name: "d", quantity: 1, unitPrice: 1, taxRate: 8 }
      ],
      10
    );

    expect(buildQuoteItemsCreateInput(resolved).map((item) => item.taxRate)).toEqual([10, null, 0, 8]);
  });
});

describe("stored-item totals", () => {
  const items = [
    { id: "i1", total: dec(1_000), taxRate: dec("10.00") },
    { id: "i2", total: dec(500), taxRate: null },
    { id: "i3", total: dec(300), taxRate: dec(8) },
    { id: "i4", total: dec(700), taxRate: dec("8.00") }
  ];

  it("groups Decimal rates numerically (8 and 8.00 are one group)", () => {
    expect(buildStoredQuoteTaxBreakdown(items)).toEqual([
      { rate: 10, base: 1_000, tax: 100 },
      { rate: 8, base: 1_000, tax: 80 },
      { rate: null, base: 500, tax: 0 }
    ]);
  });

  it("totals only the accepted subset with each line's own rate", () => {
    // i2 KCT 500 + i3 300 @8% = 324 -> 824 (a quote-level 10% would give 880)
    expect(calculateAcceptedQuoteTotal(items, ["i2", "i3"], dec(9_999))).toBe(824);
  });

  it("totals all lines when nothing is selected and falls back when the subset is empty", () => {
    // 2_500 + 100 + 80 = 2_680
    expect(calculateAcceptedQuoteTotal(items, [], dec(9_999))).toBe(2_680);
    expect(calculateAcceptedQuoteTotal(items, ["missing"], dec(9_999))).toBe(9_999);
  });
});
