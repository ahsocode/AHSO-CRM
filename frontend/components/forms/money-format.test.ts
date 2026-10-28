import { describe, expect, it } from "vitest";
import { exceedsSafeInteger, formatDecimal, formatMoney, parseDecimal, parseMoney } from "./money-format";

const value = (raw: string, o?: Parameters<typeof parseMoney>[1]) => {
  const r = parseMoney(raw, o);
  return r.ok ? r.value : r.reason;
};

describe("formatMoney", () => {
  it.each([
    [1234567, "1.234.567"],
    [0, "0"],
    [999, "999"],
    [1000, "1.000"],
    [-1500, "-1.500"],
    [10_000_000_000, "10.000.000.000"],
    [Number.MAX_SAFE_INTEGER, "9.007.199.254.740.991"],
  ])("%s -> %s", (n, s) => expect(formatMoney(n)).toBe(s));
  it("empty for undefined/null/NaN", () => {
    expect(formatMoney(undefined)).toBe("");
    expect(formatMoney(null)).toBe("");
    expect(formatMoney(Number.NaN)).toBe("");
  });
  it("truncates non-integers", () => expect(formatMoney(1500.9)).toBe("1.500"));
});

describe("parseMoney", () => {
  it("empty is undefined, never 0", () => {
    expect(value("")).toBeUndefined();
    expect(value("   ")).toBeUndefined();
  });
  it("typed 0 is 0", () => {
    expect(value("0")).toBe(0);
    expect(value("000")).toBe(0);
  });
  it("accepts grouping variants", () => {
    expect(value("1.234.567")).toBe(1234567);
    expect(value("1,234,567")).toBe(1234567);
    expect(value("1 234 567 ₫")).toBe(1234567);
    expect(value("1234567 VND")).toBe(1234567);
  });
  it("Backspace on 1.234 -> 1.23 is NOT a fraction while typing", () => {
    expect(value("1.23")).toBe(123);
  });
  it("paste mode drops a 1-2 digit fraction", () => {
    expect(value("1.234,56", { dropFraction: true })).toBe(1234);
    expect(value("1234.5", { dropFraction: true })).toBe(1234);
    expect(value("1.234", { dropFraction: true })).toBe(1234);
  });
  it("rejects negatives unless allowNegative", () => {
    expect(value("-5")).toBe("negative");
    expect(value("-5", { allowNegative: true })).toBe(-5);
    expect(value("-0", { allowNegative: true })).toBe(0);
    expect(Object.is(value("-0", { allowNegative: true }), -0)).toBe(false);
    const sign = parseMoney("-", { allowNegative: true });
    expect(sign).toEqual({ ok: true, value: undefined, text: "-" });
  });
  it("rejects garbage", () => {
    expect(value("12a")).toBe("invalid");
    expect(value("1e5")).toBe("invalid");
    expect(value("5-3", { allowNegative: true })).toBe("invalid");
  });
  it("guards MAX_SAFE_INTEGER without float rounding", () => {
    expect(value("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
    expect(value("9007199254740992")).toBe("overflow");
    expect(value("9007199254740993")).toBe("overflow");
    expect(value("99999999999999999999")).toBe("overflow");
    expect(value("9.007.199.254.740.993")).toBe("overflow");
  });
  it("returns canonical text", () => {
    const r = parseMoney("1234567");
    expect(r.ok && r.text).toBe("1.234.567");
  });
  it("round-trips format/parse for integers", () => {
    for (const n of [0, 1, 999, 1000, 123456789, 10_000_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(value(formatMoney(n))).toBe(n);
    }
  });
});

describe("exceedsSafeInteger", () => {
  it("handles leading zeros and length boundaries", () => {
    expect(exceedsSafeInteger("0009007199254740991")).toBe(false);
    expect(exceedsSafeInteger("9007199254740992")).toBe(true);
    expect(exceedsSafeInteger("10000000000000000")).toBe(true);
    expect(exceedsSafeInteger("")).toBe(false);
  });
});

describe("parseDecimal / formatDecimal", () => {
  const dec = (raw: string, o?: Parameters<typeof parseDecimal>[1]) => {
    const r = parseDecimal(raw, o);
    return r.ok ? r.value : r.reason;
  };
  it("empty is undefined; 0 is 0", () => {
    expect(dec("")).toBeUndefined();
    expect(dec("0")).toBe(0);
    expect(dec("0,0")).toBe(0);
  });
  it("accepts comma and dot as the single decimal separator", () => {
    expect(dec("2,5")).toBe(2.5);
    expect(dec("2.5")).toBe(2.5);
    expect(dec(",5")).toBe(0.5);
    expect(dec("8")).toBe(8);
  });
  it("keeps in-progress text", () => {
    expect(parseDecimal("1,")).toEqual({ ok: true, value: 1, text: "1," });
    expect(parseDecimal(",")).toEqual({ ok: true, value: undefined, text: "," });
  });
  it("limits fraction digits", () => {
    expect(dec("1,234")).toBe("too_many_decimals");
    expect(dec("1,234", { maxFractionDigits: 3 })).toBe(1.234);
    expect(dec("1,5", { maxFractionDigits: 0 })).toBe("invalid");
  });
  it("rejects multiple separators, negatives, letters, overflow", () => {
    expect(dec("1.234,5")).toBe("invalid");
    expect(dec("-1")).toBe("negative");
    expect(dec("-1,5", { allowNegative: true })).toBe(-1.5);
    expect(dec("abc")).toBe("invalid");
    expect(dec("9007199254740993")).toBe("overflow");
  });
  it("normalises leading zeros", () => {
    const r = parseDecimal("007,50");
    expect(r.ok && r.text).toBe("7,50");
    expect(dec("007,50")).toBe(7.5);
  });
  it("formatDecimal", () => {
    expect(formatDecimal(2.5)).toBe("2,5");
    expect(formatDecimal(10)).toBe("10");
    expect(formatDecimal(undefined)).toBe("");
    expect(formatDecimal(1e-7, 2)).toBe("0");
  });
});
