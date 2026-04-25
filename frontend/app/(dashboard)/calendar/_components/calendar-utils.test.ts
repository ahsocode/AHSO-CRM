import { describe, expect, it } from "vitest";
import {
  CALENDAR_LIMITS,
  calculateDaysDiff,
  getAllowedViewModes,
  getAutoSwitchedView,
  getMonthViewScale,
  validateDateRange
} from "./calendar-utils";

describe("calendar utilities", () => {
  it("calculates inclusive local date ranges without timezone shifting", () => {
    expect(calculateDaysDiff("2026-04-21", "2026-04-21")).toBe(1);
    expect(calculateDaysDiff("2026-04-20", "2026-04-21")).toBe(2);
    expect(calculateDaysDiff("2026-03-30", "2026-05-03")).toBe(35);
  });

  it("clamps long ranges from the selected start date", () => {
    expect(validateDateRange("2026-04-21", "2026-06-30", CALENDAR_LIMITS.WEEK_MAX_DAYS)).toEqual({
      dateFrom: "2026-04-21",
      dateTo: "2026-04-27",
      clamped: true
    });
  });

  it("keeps valid ranges unchanged", () => {
    expect(validateDateRange("2026-04-21", "2026-04-24", CALENDAR_LIMITS.WEEK_MAX_DAYS)).toEqual({
      dateFrom: "2026-04-21",
      dateTo: "2026-04-24",
      clamped: false
    });
  });

  it("derives allowed view modes and auto-switches invalid modes", () => {
    expect(getAllowedViewModes(7)).toEqual({ week: true, month: true });
    expect(getAllowedViewModes(35)).toEqual({ week: false, month: true });
    expect(getAllowedViewModes(120)).toEqual({ week: false, month: false });
    expect(getAutoSwitchedView("week", { week: false, month: true })).toBe("month");
  });

  it("selects month scale from range size", () => {
    expect(getMonthViewScale(31)).toBe("single");
    expect(getMonthViewScale(61)).toBe("double");
    expect(getMonthViewScale(92)).toBe("triple");
  });
});
