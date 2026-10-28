import { quoteFilterSchema } from "./quote-filter.dto";

describe("quoteFilterSchema", () => {
  it("accepts expiringWithinDays and coerces query strings", () => {
    expect(quoteFilterSchema.parse({ expiringWithinDays: "7" }).expiringWithinDays).toBe(7);
  });

  it("treats empty expiringWithinDays as unset", () => {
    expect(quoteFilterSchema.parse({ expiringWithinDays: "" }).expiringWithinDays).toBeUndefined();
  });

  it("rejects out-of-range values and limit above 100", () => {
    expect(quoteFilterSchema.safeParse({ expiringWithinDays: "0" }).success).toBe(false);
    expect(quoteFilterSchema.safeParse({ expiringWithinDays: "91" }).success).toBe(false);
    expect(quoteFilterSchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(quoteFilterSchema.parse({ limit: "50" }).limit).toBe(50);
  });
});
