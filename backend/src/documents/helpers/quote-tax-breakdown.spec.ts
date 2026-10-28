import { buildQuoteTaxBreakdown } from "./quote-tax-breakdown";

describe("buildQuoteTaxBreakdown", () => {
  it("groups by numeric rate, sorts desc with KCT last and rounds tax per group", () => {
    const result = buildQuoteTaxBreakdown([
      { quantity: 1, unitPrice: 1000, taxRate: null },
      { quantity: 3, unitPrice: 333, taxRate: "8.00" },
      { quantity: 1, unitPrice: 501, taxRate: 8 },
      { quantity: 2, unitPrice: 1000, taxRate: 10 }
    ]);
    expect(result.map((g) => g.rate)).toEqual([10, 8, null]);
    expect(result[0]).toMatchObject({ base: 2000, tax: 200, rateLabel: "10%" });
    // base 999 + 501 = 1500 -> 120 (one rounding for the whole group)
    expect(result[1]).toMatchObject({ base: 1500, tax: 120, rateLabel: "8%" });
    expect(result[2]).toMatchObject({ base: 1000, tax: 0, isKct: true, rateLabel: "KCT" });
  });

  it("keeps 0% and KCT as different groups", () => {
    const result = buildQuoteTaxBreakdown([
      { quantity: 1, unitPrice: 100, taxRate: 0 },
      { quantity: 1, unitPrice: 100, taxRate: null }
    ]);
    expect(result.map((g) => g.rate)).toEqual([0, null]);
  });

  it("falls back to defaultRate only when item taxRate is undefined", () => {
    const result = buildQuoteTaxBreakdown(
      [{ quantity: 1, unitPrice: 1000 }, { quantity: 1, unitPrice: 500, taxRate: null }],
      10
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ rate: 10, base: 1000, tax: 100 });
    expect(result[1]).toMatchObject({ rate: null, base: 500, tax: 0 });
  });

  it("returns an empty list without items", () => {
    expect(buildQuoteTaxBreakdown([])).toEqual([]);
  });
});
