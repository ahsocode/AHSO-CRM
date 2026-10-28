import { createQuoteSchema, MAX_QUOTE_AMOUNT } from "./create-quote.dto";

const makeQuote = (items: Array<{ quantity: number; unitPrice: number }>, taxRate = 0) => ({
  projectId: "project-1",
  taxRate,
  items: items.map((item, index) => ({ name: `Hạng mục ${index + 1}`, ...item }))
});

const messages = (input: unknown) => {
  const result = createQuoteSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("createQuoteSchema total limits", () => {
  it("accepts a normal quote", () => {
    const result = createQuoteSchema.safeParse(makeQuote([{ quantity: 2, unitPrice: 1_500_000 }], 10));
    expect(result.success).toBe(true);
  });

  it("rejects quantity 2000 x unitPrice 999_999_999_999", () => {
    const result = createQuoteSchema.safeParse(makeQuote([{ quantity: 2000, unitPrice: 999_999_999_999 }]));
    expect(result.success).toBe(false);
  });

  it("accepts a total exactly at the limit and rejects one above it", () => {
    expect(createQuoteSchema.safeParse(makeQuote([{ quantity: 1, unitPrice: 999_999_999_999 }])).success).toBe(true);
    // 999_999_999_999 x 1000 = 999_999_999_999_000 (just under), + 1000 x 1 exceeds
    const atLimit = createQuoteSchema.safeParse(
      makeQuote([
        { quantity: 1000, unitPrice: 999_999_999_999 },
        { quantity: 1, unitPrice: 999 }
      ])
    );
    expect(atLimit.success).toBe(true);
    const over = createQuoteSchema.safeParse(
      makeQuote([
        { quantity: 1000, unitPrice: 999_999_999_999 },
        { quantity: 1, unitPrice: 1000 }
      ])
    );
    expect(over.success).toBe(false);
    expect(MAX_QUOTE_AMOUNT).toBe(999_999_999_999_999);
  });

  it("rejects when 100% tax pushes total over the limit but subtotal is within it", () => {
    const input = makeQuote([{ quantity: 1000, unitPrice: 999_999_999_999 }], 100);
    expect(messages(input)).toContain("Tổng giá trị báo giá vượt giới hạn cho phép");
    expect(createQuoteSchema.safeParse({ ...input, taxRate: 0 }).success).toBe(true);
  });

  it("rejects many lines whose sum exceeds the limit", () => {
    const line = { quantity: 1, unitPrice: 999_999_999_999 };
    const input = makeQuote(Array.from({ length: 50 }, () => ({ ...line })).map((l) => ({ ...l, quantity: 30 })));
    expect(createQuoteSchema.safeParse(input).success).toBe(false);
  });
});

describe("createQuoteSchema per-line taxRate", () => {
  const base = { projectId: "project-1", taxRate: 10 };
  const parseItem = (taxRate: unknown) =>
    createQuoteSchema.safeParse({ ...base, items: [{ name: "Hạng mục", quantity: 1, unitPrice: 100, taxRate }] });

  it("keeps null (KCT) distinct from 0 and leaves omitted as undefined", () => {
    const kct = parseItem(null);
    const zero = parseItem(0);
    const omitted = createQuoteSchema.safeParse({ ...base, items: [{ name: "Hạng mục", quantity: 1, unitPrice: 100 }] });

    expect(kct.success && kct.data.items[0].taxRate).toBeNull();
    expect(zero.success && zero.data.items[0].taxRate).toBe(0);
    expect(omitted.success && omitted.data.items[0].taxRate).toBeUndefined();
  });

  it("accepts 0..100 with at most 2 decimals and rejects the rest", () => {
    expect(parseItem(8).success).toBe(true);
    expect(parseItem(8.25).success).toBe(true);
    expect(parseItem(100).success).toBe(true);
    expect(parseItem("5").success).toBe(true);
    expect(parseItem(8.125).success).toBe(false);
    expect(parseItem(-1).success).toBe(false);
    expect(parseItem(100.01).success).toBe(false);
    expect(parseItem("abc").success).toBe(false);
  });

  it("checks overflow against per-line VAT, not the quote default", () => {
    const bigLine = { name: "Hạng mục", quantity: 1000, unitPrice: 999_999_999_999 };
    // Default 100% would overflow, but the only line is KCT -> total = subtotal, within the limit.
    expect(createQuoteSchema.safeParse({ ...base, taxRate: 100, items: [{ ...bigLine, taxRate: null }] }).success).toBe(true);
    // Default 0% but the line itself is 100% -> overflow.
    expect(messages({ ...base, taxRate: 0, items: [{ ...bigLine, taxRate: 100 }] })).toContain(
      "Tổng giá trị báo giá vượt giới hạn cho phép"
    );
  });
});
