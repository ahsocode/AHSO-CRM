import { allocateLargestRemainder, mapCostCategory, weightShares } from "./project-finance.helpers";

describe("allocateLargestRemainder", () => {
  it("splits 1,000,001 three ways so the parts sum exactly", () => {
    const parts = allocateLargestRemainder(1_000_001, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_001);
    expect([...parts].sort()).toEqual([333_333, 333_334, 333_334].sort());
    // ties on the remainder go to the earlier index
    expect(parts).toEqual([333_334, 333_334, 333_333]);
  });

  it("gives the leftover to the largest fractional remainders", () => {
    // 100 * [5,3,2]/10 = 50,30,20 exactly; 10 * [1,1,1,7]/10 -> 1,1,1,7
    expect(allocateLargestRemainder(100, [5, 3, 2])).toEqual([50, 30, 20]);
    const parts = allocateLargestRemainder(10, [333, 333, 334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(parts).toEqual([3, 3, 4]);
  });

  it("stays exact for large amounts and uneven weights", () => {
    const weights = [123_456_789, 987_654_321, 5, 77_777];
    const total = 9_876_543_210;
    const parts = allocateLargestRemainder(total, weights);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    parts.forEach((p) => expect(Number.isInteger(p)).toBe(true));
  });

  it("never gives money to zero-weight entries", () => {
    expect(allocateLargestRemainder(7, [0, 1, 1, 0])).toEqual([0, 4, 3, 0]);
  });

  it("supports fractional manual weights", () => {
    const parts = allocateLargestRemainder(1000, [33.3, 33.3, 33.4]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("rejects an empty basis", () => {
    expect(() => allocateLargestRemainder(100, [0, 0])).toThrow(/cơ sở phân bổ/);
  });

  it("returns shares that sum to ~1", () => {
    const shares = weightShares([1, 1, 1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeGreaterThan(0.999);
  });
});

describe("mapCostCategory", () => {
  it.each([
    ["Đi lại - công tác", "TRAVEL"],
    ["Grab", "TRAVEL"],
    ["xăng xe", "TRAVEL"],
    ["Vận chuyển", "SHIPPING"],
    ["travel", "TRAVEL"],
    ["MECHANICAL", "MECHANICAL"],
    ["Phần mềm", "SOFTWARE"],
    ["Thuê ngoài", "OUTSOURCE"],
    ["Tiếp khách", "OTHER"],
    ["", "OTHER"]
  ])("%s -> %s", (input, expected) => {
    expect(mapCostCategory(input)).toBe(expected);
  });
});
