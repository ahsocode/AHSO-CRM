"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useCallback, useRef } from "react";
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
  getMonthViewScale,
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

function getMonthRange(year: number, month: number) {
  const days = getMonthGridDays(year, month);
  return { dateFrom: days[0], dateTo: days[days.length - 1] };
}

export function CalendarClient() {
  const user = useAuthStore((state) => state.user);
  const canManageUsers = isLeadershipRole(user?.role);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [defaultWeekRange] = useState(() => getDefaultWeekRange());
  const warningShownRef = useRef(false);

  // Week view state
  const [weekDateFrom, setWeekDateFrom] = useState(defaultWeekRange.dateFrom);
  const [weekDateTo, setWeekDateTo] = useState(defaultWeekRange.dateTo);

  // Month view state — always the full grid range of the target month
  const todayRef = new Date();
  const [monthYear, setMonthYear] = useState(todayRef.getFullYear());
  const [monthMonth, setMonthMonth] = useState(todayRef.getMonth());

  // Shared filter state
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [completion, setCompletion] = useState<"all" | "open" | "completed">("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [page, setPage] = useState(1);

  // Debounce search to avoid rapid API calls on every keystroke
  const debouncedSearch = useDebounce(search.trim(), 500);

  // Compute active date range based on view mode
  const dateFrom = viewMode === "week" ? weekDateFrom : getMonthRange(monthYear, monthMonth).dateFrom;
  const dateTo   = viewMode === "week" ? weekDateTo   : getMonthRange(monthYear, monthMonth).dateTo;

  // Calculate days and validate date range
  const dayCount = calculateDaysDiff(dateFrom, dateTo);
  const allowedModes = getAllowedViewModes(dayCount);
  const monthScale = getMonthViewScale(dayCount);

  // Validate and clamp date range if needed
  const { dateTo: clampedDateTo, clamped } = validateDateRange(
    dateFrom,
    dateTo,
    CALENDAR_LIMITS.MONTH_MAX_DAYS
  );

  // If clamped, update state
  useEffect(() => {
    if (clamped && dateTo !== clampedDateTo) {
      if (viewMode === "week") {
        setWeekDateTo(clampedDateTo);
      } else {
        const d = new Date(`${clampedDateTo}T00:00:00`);
        setMonthMonth(d.getMonth());
      }
    }
  }, [clamped, dateTo, clampedDateTo, viewMode]);

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

  useEffect(() => { setPage(1); }, [assigneeId, completion, dateFrom, dateTo, debouncedSearch, type]);

  // When user manually changes date range via filter inputs while in week mode
  const handleWeekDateRangeChange = (from: string, to: string) => {
    setWeekDateFrom(from);
    setWeekDateTo(to);
  };

  // When month view changes month
  const handleMonthChange = (year: number, month: number) => {
    setMonthYear(year);
    setMonthMonth(month);
  };

  // Toggle view and auto-sync dateFrom/dateTo
  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    if (mode === "week") {
      // Jump week view to the week that contains month view's first visible day
      const { dateFrom: mFrom } = getMonthRange(monthYear, monthMonth);
      const d = new Date(`${mFrom}T00:00:00`);
      const dayIndex = (d.getDay() + 6) % 7;
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      setWeekDateFrom(toDateStr(start));
      setWeekDateTo(toDateStr(end));
    } else {
      // Jump month view to the month containing the week start
      const d = new Date(`${weekDateFrom}T00:00:00`);
      setMonthYear(d.getFullYear());
      setMonthMonth(d.getMonth());
    }
  };

  const defaultRange = defaultWeekRange;
  const canReset =
    search.length > 0 ||
    (viewMode === "week" && (weekDateFrom !== defaultRange.dateFrom || weekDateTo !== defaultRange.dateTo)) ||
    type.length > 0 ||
    completion !== "all" ||
    assigneeId.length > 0;

  const usersQuery = useUsers(canManageUsers);
  const calendarQuery = useCalendarEvents({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    dateFrom,
    dateTo,
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
    if (viewMode === "week") {
      setWeekDateFrom(defaultRange.dateFrom);
      setWeekDateTo(defaultRange.dateTo);
    } else {
      const now = new Date();
      setMonthYear(now.getFullYear());
      setMonthMonth(now.getMonth());
    }
  };

  // Jump to a specific date
  const handleJumpToDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (viewMode === "week") {
      // Jump week to the week containing this date
      const dayIndex = (d.getDay() + 6) % 7;
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      setWeekDateFrom(toDateStr(start));
      setWeekDateTo(toDateStr(end));
    } else {
      // Jump month to the month containing this date
      setMonthYear(d.getFullYear());
      setMonthMonth(d.getMonth());
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lịch & Công việc"
        description="Xem lịch công tác theo tuần hoặc tháng. Kéo activity sang ngày khác để dời lịch, click để sửa."
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

            <Link href="/activities/new" className={cn(buttonVariants({ variant: "primary" }))}>
              + Tạo hoạt động
            </Link>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
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
        dateFrom={dateFrom}
        dateTo={dateTo}
        onAssigneeIdChange={setAssigneeId}
        onCompletionChange={setCompletion}
        onDateFromChange={(v) => {
          setWeekDateFrom(v);
          const d = new Date(`${v}T00:00:00`);
          setMonthYear(d.getFullYear());
          setMonthMonth(d.getMonth());
        }}
        onDateToChange={(v) => {
          setWeekDateTo(v);
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
          dateFrom={weekDateFrom}
          dateTo={weekDateTo}
          onDateRangeChange={handleWeekDateRangeChange}
        />
      ) : (
        <CalendarMonthView
          errorMessage={getApiErrorMessage(calendarQuery.error, "Không thể tải lịch công việc.")}
          isError={calendarQuery.isError}
          isLoading={calendarQuery.isLoading}
          items={calendarQuery.data?.items ?? []}
          meta={calendarQuery.data?.meta}
          dateFrom={dateFrom}
          onMonthChange={handleMonthChange}
          scale={monthScale}
        />
      )}
    </div>
  );
}
