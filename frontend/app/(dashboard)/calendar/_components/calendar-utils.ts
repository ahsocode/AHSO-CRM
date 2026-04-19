/**
 * Calendar display mode utilities with smart auto-switching logic
 */

export const CALENDAR_LIMITS = {
  WEEK_MAX_DAYS: 7,      // Week view: max 7 days (T2-CN)
  MONTH_MAX_DAYS: 92,    // Month view: max 92 days (3 months)
} as const;

export type MonthViewScale = "single" | "double" | "triple";

/**
 * Calculate number of days between two dates (inclusive)
 */
export function calculateDaysDiff(dateFrom: string, dateTo: string): number {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Validate and optionally limit date range
 * Returns { dateFrom, dateTo, clamped }
 */
export function validateDateRange(
  dateFrom: string,
  dateTo: string,
  maxDays: number
): { dateFrom: string; dateTo: string; clamped: boolean } {
  const days = calculateDaysDiff(dateFrom, dateTo);

  if (days <= maxDays) {
    return { dateFrom, dateTo, clamped: false };
  }

  // Clamp: extend from date forward by maxDays
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + maxDays - 1);

  const clampedTo = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(
    to.getDate()
  ).padStart(2, "0")}`;

  return { dateFrom, dateTo: clampedTo, clamped: true };
}

/**
 * Determine which view modes are allowed based on day count
 */
export function getAllowedViewModes(
  dayCount: number
): { week: boolean; month: boolean } {
  return {
    week: dayCount <= CALENDAR_LIMITS.WEEK_MAX_DAYS,
    month: dayCount <= CALENDAR_LIMITS.MONTH_MAX_DAYS,
  };
}

/**
 * Get the scale mode for month view based on day count
 */
export function getMonthViewScale(dayCount: number): MonthViewScale {
  if (dayCount <= 31) return "single";
  if (dayCount <= 61) return "double";
  return "triple";
}

/**
 * Auto-switch view if current mode becomes invalid
 */
export function getAutoSwitchedView(
  currentMode: "week" | "month",
  allowed: { week: boolean; month: boolean }
): "week" | "month" {
  if (allowed[currentMode]) return currentMode;
  if (allowed.month) return "month";
  return "week";
}

/**
 * Get grid columns and cell size for month view
 */
export function getMonthViewGridConfig(scale: MonthViewScale): {
  cols: number;
  cellHeightClass: string;
  dayNameClass: string;
  dayNumberClass: string;
  activityClass: string;
} {
  switch (scale) {
    case "single":
      return {
        cols: 1,
        cellHeightClass: "min-h-[110px]",
        dayNameClass: "text-xs",
        dayNumberClass: "h-6 w-6 text-xs",
        activityClass: "text-[11px]",
      };
    case "double":
      return {
        cols: 2,
        cellHeightClass: "min-h-[55px]",
        dayNameClass: "text-[10px]",
        dayNumberClass: "h-5 w-5 text-[10px]",
        activityClass: "text-[10px]",
      };
    case "triple":
      return {
        cols: 3,
        cellHeightClass: "min-h-[40px]",
        dayNameClass: "text-[9px]",
        dayNumberClass: "h-4 w-4 text-[9px]",
        activityClass: "text-[9px]",
      };
  }
}
