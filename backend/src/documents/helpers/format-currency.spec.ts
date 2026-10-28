import { Prisma } from "@prisma/client";
import { MISSING_AMOUNT, amountInWords, currencyHelper, toAmount } from "./format-currency";

describe("currency helper (money)", () => {
  it.each([null, undefined, "", "abc", Number.NaN, Number.POSITIVE_INFINITY, {}])(
    "prints the missing marker, never 0, for %p",
    (value) => {
      expect(currencyHelper(value)).toBe(MISSING_AMOUNT);
      expect(currencyHelper(value, "short")).toBe(MISSING_AMOUNT);
      expect(currencyHelper(value, "words")).toBe(MISSING_AMOUNT);
      expect(toAmount(value)).toBeNull();
    }
  );

  it("still prints a real zero as 0", () => {
    expect(currencyHelper(0)).toBe("0 VND");
    expect(currencyHelper("0")).toBe("0 VND");
    expect(currencyHelper(0, "words")).toBe("Không đồng");
  });

  it("formats numbers, numeric strings and Prisma Decimals", () => {
    expect(currencyHelper(88410000)).toBe("88.410.000 VND");
    expect(currencyHelper("26523000")).toBe("26.523.000 VND");
    expect(currencyHelper(new Prisma.Decimal("8841000"))).toBe("8.841.000 VND");
    expect(currencyHelper(-1500)).toBe("-1.500 VND");
    expect(currencyHelper(1250000, "short")).toBe("1,3 triệu");
  });

  it("reads amounts in words once with ' đồng', rounded like the printed figure", () => {
    expect(amountInWords(88410000)).toBe("Tám mươi tám triệu bốn trăm mười nghìn đồng");
    expect(currencyHelper(1234.6)).toBe("1.235 VND");
    expect(amountInWords(1234.6)).toBe("Một nghìn hai trăm ba mươi lăm đồng");
    expect(amountInWords(-2000)).toBe("Âm hai nghìn đồng");
    expect(amountInWords(5000).match(/đồng/g)).toHaveLength(1);
  });

  it("never throws for large amounts (>= 1.000 tỷ) and refuses unsafe integers gracefully", () => {
    expect(() => amountInWords(1_000_000_000_000)).not.toThrow();
    expect(amountInWords(1_000_000_000_000)).toBe("Một nghìn tỷ đồng");
    expect(amountInWords(Number.MAX_SAFE_INTEGER * 4)).toBe(MISSING_AMOUNT);
  });
});
