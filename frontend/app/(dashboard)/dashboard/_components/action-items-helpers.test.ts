import { describe, expect, it } from "vitest";
import {
  formatBarLabel,
  getActionItemBadge,
  getActionItemHref,
  summarizeRevenue
} from "./action-items-helpers";

describe("action item helpers", () => {
  it("builds links per kind", () => {
    expect(getActionItemHref({ kind: "QUOTE", id: "q1" })).toBe("/quotes/q1");
    expect(getActionItemHref({ kind: "PROJECT", id: "p1" })).toBe("/projects/p1");
    expect(getActionItemHref({ kind: "CONTRACT", id: "c1" })).toBe("/contracts/c1");
    expect(getActionItemHref({ kind: "ACTIVITY", id: "a1" })).toBe("/activities/a1");
  });

  it("badges overdue, waiting and debt items with text", () => {
    expect(getActionItemBadge({ kind: "PROJECT", overdue: true, ageDays: 3, amount: null })).toBe("Trễ 3 ngày");
    expect(getActionItemBadge({ kind: "QUOTE", overdue: false, ageDays: 9, amount: 5 })).toBe("9 ngày");
    expect(getActionItemBadge({ kind: "ACTIVITY", overdue: false, ageDays: 0, amount: null })).toBe("Hôm nay");
    expect(getActionItemBadge({ kind: "CONTRACT", overdue: false, ageDays: 30, amount: 2_500_000 })).toContain("Còn");
  });

  it("skips labels for zero bars", () => {
    expect(formatBarLabel(0)).toBe("");
    expect(formatBarLabel(undefined)).toBe("");
    expect(formatBarLabel(2_000_000_000)).toContain("tỷ");
  });

  it("summarises revenue for screen readers", () => {
    expect(summarizeRevenue([{ month: "T1", revenue: 0 }])).toBe("Chưa có doanh thu trong kỳ.");
    expect(summarizeRevenue([{ month: "T2", revenue: 3_000_000 }])).toContain("T2");
  });
});
