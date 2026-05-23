"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useUsers } from "@/hooks/use-users";
import { useDebounce } from "@/hooks/use-debounce";
import { isLeadershipRole } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarMonthView, getMonthGridDays } from "./calendar-month-view";
import { CalendarFilters } from "./calendar-filters";
import { CalendarOverviewCards } from "./calendar-overview-cards";
import {
  calculateDaysDiff,
  validateDateRange,
  getAllowedViewModes,
  getAutoSwitchedView,
  CALENDAR_LIMITS,
} from "./calendar-utils";

type ViewMode = "week" | "month";

const PAGE_SIZE = 500;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultWeekRange() {
  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayIndex);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
}

function getWeekRangeForDate(dateStr: string) {
  const selected = new Date(`${dateStr}T00:00:00`);
  const dayIndex = (selected.getDay() + 6) % 7;
  const start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - dayIndex);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
}

function isDateParam(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getMonthSelectionRange(year: number, month: number, spanMonths = 1) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + spanMonths, 0);
  return { dateFrom: toDateStr(start), dateTo: toDateStr(end) };
}

function getMonthSpanCount(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  return Math.max(1, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1);
}

function getDefaultCreateDateTime(dateFrom: string, dateTo: string) {
  const today = toDateStr(new Date());
  const selectedDate = today >= dateFrom && today <= dateTo ? today : dateFrom;
  return `${selectedDate}T09:00`;
}

export function CalendarClient() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const user = useAuthStore((state) => state.user);
  const canManageUsers = isLeadershipRole(user?.role);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [defaultWeekRange] = useState(() => getDefaultWeekRange());
  const [initialRange] = useState(() =>
    isDateParam(dateParam) ? getWeekRangeForDate(dateParam) : defaultWeekRange
  );
  const warningShownRef = useRef(false);

  // Shared selected date range across both week/month views.
  const [rangeDateFrom, setRangeDateFrom] = useState(initialRange.dateFrom);
  const [rangeDateTo, setRangeDateTo] = useState(initialRange.dateTo);

  // Shared filter state
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [completion, setCompletion] = useState<"all" | "open" | "completed">("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search to avoid rapid API calls on every keystroke
  const debouncedSearch = useDebounce(search.trim(), 500);

  // Calculate days and validate selected date range
  const dayCount = calculateDaysDiff(rangeDateFrom, rangeDateTo);
  const allowedModes = getAllowedViewModes(dayCount);

  // Validate and clamp date range if needed
  const { dateTo: clampedDateTo, clamped } = validateDateRange(
    rangeDateFrom,
    rangeDateTo,
    CALENDAR_LIMITS.MONTH_MAX_DAYS
  );

  // If clamped, update state
  useEffect(() => {
    if (clamped && rangeDateTo !== clampedDateTo) {
      setRangeDateTo(clampedDateTo);
    }
  }, [clamped, rangeDateTo, clampedDateTo]);

  // Auto-switch view if current mode becomes invalid
  const effectiveViewMode = getAutoSwitchedView(viewMode, allowedModes);
  useEffect(() => {
    if (effectiveViewMode !== viewMode) {
      setViewMode(effectiveViewMode);
    }
  }, [effectiveViewMode, viewMode]);

  // Show warning when week mode exceeds 7 days
  useEffect(() => {
    if (dayCount > CALENDAR_LIMITS.WEEK_MAX_DAYS && !warningShownRef.current) {
      warningShownRef.current = true;
      toast.info(`📌 ${dayCount} ngày — Tuần bị tắt, dùng Tháng hoặc rút ngắn khoảng ngày`);
    } else if (dayCount <= CALENDAR_LIMITS.WEEK_MAX_DAYS) {
      warningShownRef.current = false;
    }
  }, [dayCount]);

  useEffect(() => { setPage(1); }, [assigneeId, completion, rangeDateFrom, rangeDateTo, debouncedSearch, type]);

  useEffect(() => {
    if (!isDateParam(dateParam)) return;
    const nextRange = getWeekRangeForDate(dateParam);
    setRangeDateFrom(nextRange.dateFrom);
    setRangeDateTo(nextRange.dateTo);
    setViewMode("week");
  }, [dateParam]);

  const handleDateRangeChange = (from: string, to: string) => {
    setRangeDateFrom(from);
    setRangeDateTo(to);
  };

  const handleMonthChange = (year: number, month: number) => {
    const monthSpanCount = getMonthSpanCount(rangeDateFrom, rangeDateTo);
    const nextRange = getMonthSelectionRange(year, month, monthSpanCount);
    setRangeDateFrom(nextRange.dateFrom);
    setRangeDateTo(nextRange.dateTo);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
  };

  const defaultRange = defaultWeekRange;
  const canReset =
    search.length > 0 ||
    rangeDateFrom !== defaultRange.dateFrom ||
    rangeDateTo !== defaultRange.dateTo ||
    type.length > 0 ||
    completion !== "all" ||
    assigneeId.length > 0;

  const usersQuery = useUsers(canManageUsers);
  const createActivityHref = `/activities/new?returnTo=calendar&scheduledAt=${encodeURIComponent(
    getDefaultCreateDateTime(rangeDateFrom, rangeDateTo)
  )}` as Route;
  const calendarQuery = useCalendarEvents({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    dateFrom: rangeDateFrom,
    dateTo: rangeDateTo,
    type: type || undefined,
    isCompleted: completion === "all" ? undefined : completion === "completed",
    assigneeId: canManageUsers ? assigneeId || undefined : undefined
  });

  const handleReset = () => {
    setSearch("");
    setType("");
    setCompletion("all");
    setAssigneeId("");
    setPage(1);
    if (viewMode === "month") {
      const now = new Date();
      const currentMonth = getMonthSelectionRange(now.getFullYear(), now.getMonth(), 1);
      setRangeDateFrom(currentMonth.dateFrom);
      setRangeDateTo(currentMonth.dateTo);
    } else {
      setRangeDateFrom(defaultRange.dateFrom);
      setRangeDateTo(defaultRange.dateTo);
    }
  };

  const handleJumpToDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (viewMode === "week") {
      const dayIndex = (d.getDay() + 6) % 7;
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      setRangeDateFrom(toDateStr(start));
      setRangeDateTo(toDateStr(end));
    } else {
      const monthSpanCount = getMonthSpanCount(rangeDateFrom, rangeDateTo);
      const nextRange = getMonthSelectionRange(d.getFullYear(), d.getMonth(), monthSpanCount);
      setRangeDateFrom(nextRange.dateFrom);
      setRangeDateTo(nextRange.dateTo);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Work Calendar"
        title="Lịch công việc"
        description="Điều phối cuộc gọi, họp, khảo sát và follow-up theo tuần hoặc tháng. Kéo activity sang ngày khác để dời lịch."
        action={
          <div className="flex flex-wrap items-center gap-3">
{/* View mode toggle with smart enable/disable */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center rounded-lg border border-border bg-bg-card p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleViewModeChange("week")}
                  disabled={!allowedModes.week}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    !allowedModes.week && "cursor-not-allowed opacity-50",
                    viewMode === "week" && allowedModes.week
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:disabled:text-text-secondary"
                  )}
                  title={!allowedModes.week ? `Tuần chỉ cho phép ≤ ${CALENDAR_LIMITS.WEEK_MAX_DAYS} ngày` : ""}
                >
                  Tuần
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange("month")}
                  disabled={!allowedModes.month}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    !allowedModes.month && "cursor-not-allowed opacity-50",
                    viewMode === "month" && allowedModes.month
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:disabled:text-text-secondary"
                  )}
                  title={!allowedModes.month ? `Tháng chỉ cho phép ≤ ${CALENDAR_LIMITS.MONTH_MAX_DAYS} ngày` : ""}
                >
                  Tháng
                </button>
              </div>
            </div>

            <Link href={createActivityHref} className={cn(buttonVariants({ variant: "primary" }))}>
              + Tạo hoạt động
            </Link>
          </div>
        }
      />

      <CalendarOverviewCards meta={calendarQuery.data?.meta} isLoading={calendarQuery.isLoading} />

      <CalendarFilters
        assigneeId={assigneeId}
        assignees={usersQuery.data ?? []}
        assigneesUnavailable={!canManageUsers || usersQuery.isError}
        canFilterAssignee={canManageUsers}
        canReset={canReset}
        completion={completion}
        dateFrom={rangeDateFrom}
        dateTo={rangeDateTo}
        onAssigneeIdChange={setAssigneeId}
        onCompletionChange={setCompletion}
        onDateFromChange={(v) => {
          if (!v) return;
          setRangeDateFrom(v);
          if (v > rangeDateTo) {
            setRangeDateTo(v);
          }
        }}
        onDateToChange={(v) => {
          if (!v) return;
          setRangeDateTo(v);
          if (v < rangeDateFrom) {
            setRangeDateFrom(v);
          }
        }}
        onReset={handleReset}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onJumpToDate={handleJumpToDate}
        search={search}
        type={type}
      />

      {viewMode === "week" ? (
        <CalendarWeekView
          errorMessage={getApiErrorMessage(calendarQuery.error, "Không thể tải lịch công việc.")}
          isError={calendarQuery.isError}
          isLoading={calendarQuery.isLoading}
          items={calendarQuery.data?.items ?? []}
          meta={calendarQuery.data?.meta}
          dateFrom={rangeDateFrom}
          dateTo={rangeDateTo}
          onDateRangeChange={handleDateRangeChange}
        />
      ) : (
        <CalendarMonthView
          errorMessage={getApiErrorMessage(calendarQuery.error, "Không thể tải lịch công việc.")}
          isError={calendarQuery.isError}
          isLoading={calendarQuery.isLoading}
          items={calendarQuery.data?.items ?? []}
          meta={calendarQuery.data?.meta}
          dateFrom={rangeDateFrom}
          dateTo={rangeDateTo}
          onMonthChange={handleMonthChange}
        />
      )}
    </div>
  );
}
