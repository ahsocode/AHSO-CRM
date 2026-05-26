import { Decimal } from "@prisma/client/runtime/library";
import { decimalToNumber, sumDecimal, toDecimal } from "./decimal";

describe("decimal utils", () => {
  it("converts nullish values to zero Decimal", () => {
    expect(toDecimal(null).equals(0)).toBe(true);
    expect(toDecimal(undefined).equals(0)).toBe(true);
  });

  it("sums mixed decimal-like values without floating point drift", () => {
    const total = sumDecimal(["0.1", new Decimal("0.2"), 0.3]);
    expect(total.equals(new Decimal("0.6"))).toBe(true);
  });

  it("converts Decimal to number only at response boundaries", () => {
    expect(decimalToNumber(new Decimal("123.45"))).toBe(123.45);
  });
});
