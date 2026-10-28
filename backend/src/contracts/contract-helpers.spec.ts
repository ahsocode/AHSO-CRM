import { Prisma } from "@prisma/client";
import { calculateContractValueFromQuoteItems } from "./contract-helpers";

const dec = (value: number | string) => new Prisma.Decimal(value);

describe("calculateContractValueFromQuoteItems (per-line VAT)", () => {
  it("applies each selected line's own rate, grouped, with KCT untaxed", () => {
    // 10%: 1_000 -> 100 | 8%: 1_006 + 1_006 = 2_012 -> 161 (group-rounded) | KCT 500 -> 0
    const value = calculateContractValueFromQuoteItems([
      { total: dec(1_000), taxRate: dec(10) },
      { total: dec(1_006), taxRate: dec(8) },
      { total: dec(1_006), taxRate: dec("8.00") },
      { total: dec(500), taxRate: null }
    ]);

    expect(value).toBe(3_773);
  });

  it("treats 0% and KCT both as untaxed", () => {
    expect(
      calculateContractValueFromQuoteItems([
        { total: dec(400), taxRate: dec(0) },
        { total: dec(600), taxRate: null }
      ])
    ).toBe(1_000);
  });
});
