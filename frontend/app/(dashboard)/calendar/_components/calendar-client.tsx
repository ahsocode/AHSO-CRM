"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarFilters } from "./calendar-filters";
import { CalendarOverviewCards } from "./calendar-overview-cards";

const PAGE_SIZE = 200;

function getDefaultDateRange() {
  const today = new Date();
  const dayIndex = (today.getDay() + 6) % 7;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayIndex);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10)
  };
}

export function CalendarClient() {
  const user = useAuthStore((state) => state.user);
  const canManageUsers = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [defaultRange] = useState(() => getDefaultDateRange());
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [type, setType] = useState<ActivityType | "">("");
  const [completion, setCompletion] = useState<"all" | "open" | "completed">("all");
  const [assigneeId, setAssigneeId] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const handleDateRangeChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  useEffect(() => {
    setPage(1);
  }, [assigneeId, completion, dateFrom, dateTo, deferredSearch, type]);

  const usersQuery = useUsers(canManageUsers);
  const calendarQuery = useCalendarEvents({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    dateFrom,
    dateTo,
    type: type || undefined,
    isCompleted:
      completion === "all" ? undefined : completion === "completed",
    assigneeId: canManageUsers ? assigneeId || undefined : undefined
  });

  const canReset =
    search.length > 0 ||
    dateFrom !== defaultRange.dateFrom ||
    dateTo !== defaultRange.dateTo ||
    type.length > 0 ||
    completion !== "all" ||
    assigneeId.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lịch & Công việc"
        description="Xem toàn bộ lịch công tác theo tuần. Kéo activity sang ngày khác để dời lịch, click để xem/sửa chi tiết."
        action={
          <div className="flex flex-wrap items-center gap-3">
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
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onReset={() => {
          setSearch("");
          setDateFrom(defaultRange.dateFrom);
          setDateTo(defaultRange.dateTo);
          setType("");
          setCompletion("all");
          setAssigneeId("");
          setPage(1);
        }}
        onSearchChange={setSearch}
        onTypeChange={setType}
        search={search}
        type={type}
      />

      <CalendarWeekView
        errorMessage={getApiErrorMessage(calendarQuery.error, "Không thể tải lịch công việc.")}
        isError={calendarQuery.isError}
        isLoading={calendarQuery.isLoading}
        items={calendarQuery.data?.items ?? []}
        meta={calendarQuery.data?.meta}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateRangeChange={handleDateRangeChange}
      />
    </div>
  );
}
