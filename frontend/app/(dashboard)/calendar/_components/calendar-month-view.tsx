"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useUpdateActivity } from "@/hooks/use-activities";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { ActivityType, CalendarEventItem, CalendarListMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MonthViewScale, getMonthViewGridConfig } from "./calendar-utils";

const WEEKDAY_SHORT_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_NAMES_VI = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

const ACTIVITY_TYPE_DOT: Record<ActivityType, string> = {
  CALL:     "bg-info",
  EMAIL:    "bg-slate-400",
  MEETING:  "bg-primary",
  SURVEY:   "bg-warning",
  DEMO:     "bg-success",
  NOTE:     "bg-slate-400",
  FOLLOWUP: "bg-warning"
};

const ACTIVITY_TYPE_BAR: Record<ActivityType, string> = {
  CALL:     "bg-info/20 text-info border-l-2 border-info",
  EMAIL:    "bg-slate-100 text-slate-600 border-l-2 border-slate-400",
  MEETING:  "bg-primary/10 text-primary border-l-2 border-primary",
  SURVEY:   "bg-warning/15 text-warning border-l-2 border-warning",
  DEMO:     "bg-success/15 text-success border-l-2 border-success",
  NOTE:     "bg-slate-100 text-slate-600 border-l-2 border-slate-400",
  FOLLOWUP: "bg-warning/15 text-warning border-l-2 border-warning"
};

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns days for the month grid: fills to full weeks (Mon-Sun) */
export function getMonthGridDays(year: number, month: number): string[] {
  // month is 0-indexed
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  // Align to Monday
  const startDayIndex = (firstOfMonth.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(year, month, 1 - startDayIndex);

  // Align end to Sunday
  const endDayIndex = (lastOfMonth.getDay() + 6) % 7; // 0=Mon
  const daysToAdd = endDayIndex === 6 ? 0 : 6 - endDayIndex;
  const gridEnd = new Date(year, month + 1, 0 + daysToAdd);

  const days: string[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(toLocalDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function groupItemsByDay(items: CalendarEventItem[]): Map<string, CalendarEventItem[]> {
  const groups = new Map<string, CalendarEventItem[]>();
  for (const item of items) {
    const d = new Date(item.anchorAt);
    const key = toLocalDateStr(d);
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }
  for (const [key, dayItems] of groups) {
    groups.set(key, dayItems.sort((a, b) =>
      new Date(a.anchorAt).getTime() - new Date(b.anchorAt).getTime()
    ));
  }
  return groups;
}

function isToday(dateStr: string): boolean {
  return toLocalDateStr(new Date()) === dateStr;
}

function isCurrentMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getFullYear() === year && d.getMonth() === month;
}

function formatTimeShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface RescheduleState {
  activityId: string;
  activityTitle: string;
  oldDate: string;
  newDate: string;
  oldTime: string;
  newTime: string;
}

interface CalendarMonthViewProps {
  items: CalendarEventItem[];
  meta?: CalendarListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  /** Controls the visible month — derived from dateFrom */
  dateFrom: string;
  onMonthChange: (year: number, month: number) => void;
  /** Scale: single (1 month), double (2 months), triple (3 months) */
  scale?: MonthViewScale;
}

export function CalendarMonthView({
  items,
  isLoading,
  isError,
  errorMessage,
  dateFrom,
  onMonthChange,
  scale = "single"
}: CalendarMonthViewProps) {
  const router = useRouter();
  const updateMutation = useUpdateActivity();

  // Parse current month from dateFrom
  const [viewYear, viewMonth] = (() => {
    const d = new Date(`${dateFrom}T00:00:00`);
    return [d.getFullYear(), d.getMonth()];
  })();

  const [draggedItem, setDraggedItem] = useState<CalendarEventItem | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [rescheduleDialog, setRescheduleDialog] = useState<RescheduleState | null>(null);

  // Get grid config based on scale
  const gridConfig = getMonthViewGridConfig(scale);

  // Collect months to display based on scale
  const months: Array<{ year: number; month: number }> = [];
  if (scale === "single") {
    months.push({ year: viewYear, month: viewMonth });
  } else if (scale === "double") {
    months.push({ year: viewYear, month: viewMonth });
    const nextMonth = viewMonth + 1;
    months.push({
      year: nextMonth > 11 ? viewYear + 1 : viewYear,
      month: nextMonth > 11 ? 0 : nextMonth
    });
  } else {
    months.push({ year: viewYear, month: viewMonth });
    const nextMonth = viewMonth + 1;
    const nextNextMonth = viewMonth + 2;
    months.push({
      year: nextMonth > 11 ? viewYear + 1 : viewYear,
      month: nextMonth > 11 ? 0 : nextMonth
    });
    months.push({
      year: nextNextMonth > 11 ? viewYear + 1 : viewYear,
      month: nextNextMonth > 11 ? nextNextMonth - 12 : nextNextMonth
    });
  }

  // Collect all days from all months
  const allGridDays = months.flatMap(({ year, month }) => getMonthGridDays(year, month));
  const itemsByDay = groupItemsByDay(items);

  // Navigation
  const handlePrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };
  const handleNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };
  const handleToday = () => {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth());
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, item: CalendarEventItem) => {
    e.stopPropagation();
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverDate(null);
  };
  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== date) setDragOverDate(date);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragOverDate(null);
    }
  };
  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!draggedItem) return;
    const anchor = new Date(draggedItem.anchorAt);
    const oldDateStr = toLocalDateStr(anchor);
    if (oldDateStr === targetDate) { setDraggedItem(null); return; }
    const oldTime = draggedItem.scheduledAt ? formatTimeShort(draggedItem.scheduledAt) : "09:00";
    setRescheduleDialog({
      activityId: draggedItem.id,
      activityTitle: draggedItem.title,
      oldDate: oldDateStr,
      newDate: targetDate,
      oldTime,
      newTime: oldTime
    });
    setDraggedItem(null);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleDialog) return;
    try {
      const [hours, minutes] = rescheduleDialog.newTime.split(":").map(Number);
      const newDate = new Date(`${rescheduleDialog.newDate}T00:00:00`);
      newDate.setHours(hours, minutes, 0, 0);
      await updateMutation.mutateAsync({
        id: rescheduleDialog.activityId,
        input: { scheduledAt: newDate }
      });
      setRescheduleDialog(null);
    } catch { /* toast handled by hook */ }
  };

  // Generate weeks for all months
  const weeks: string[][] = [];
  for (let i = 0; i < allGridDays.length; i += 7) {
    weeks.push(allGridDays.slice(i, i + 7));
  }

  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardContent className="p-4">
          <LoadingSkeleton className="h-[600px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardContent className="p-4">
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải lịch công việc."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-white/70">
      {/* Header */}
      <CardHeader className="mb-0 gap-2 border-b border-border/50 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Lịch công tác
          </p>
          <h2 className="font-heading text-xl font-bold text-text-primary">
            {months.map(m => `${MONTH_NAMES_VI[m.month]}`).join(" - ")} {viewYear}
            {scale !== "single" && ` (${scale === "double" ? "2" : "3"} tháng)`}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {items.length} activity · Kéo thả giữa các ngày để dời lịch, click để sửa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handlePrevMonth} className="h-9 px-3" aria-label="Tháng trước">
            <AppIcon name="arrow-left" className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={handleToday} className="h-9 px-4">
            Hôm nay
          </Button>
          <Button type="button" variant="outline" onClick={handleNextMonth} className="h-9 px-3" aria-label="Tháng sau">
            <AppIcon name="arrow-right" className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Render months side-by-side based on scale */}
        <div className={cn("grid gap-0", {
          "grid-cols-1": scale === "single",
          "grid-cols-2": scale === "double",
          "grid-cols-3": scale === "triple"
        })}>
          {months.map((month) => {
            const monthDays = getMonthGridDays(month.year, month.month);
            const monthWeeks: string[][] = [];
            for (let i = 0; i < monthDays.length; i += 7) {
              monthWeeks.push(monthDays.slice(i, i + 7));
            }

            return (
              <div key={`${month.year}-${month.month}`} className="border-r border-border/40 last:border-r-0">
                {/* Month title */}
                <div className="border-b border-border/50 bg-bg-hover/30 px-2 py-2 text-center">
                  <p className={cn("font-semibold", gridConfig.dayNameClass)}>
                    {MONTH_NAMES_VI[month.month]}
                  </p>
                </div>

                {/* Weekday header */}
                <div className={cn("grid grid-cols-7 border-b border-border/50 bg-bg-hover/20")}>
                  {WEEKDAY_SHORT_VI.map((label) => (
                    <div
                      key={label}
                      className={cn("px-1 py-1 text-center font-semibold uppercase tracking-wider text-text-secondary", gridConfig.dayNameClass)}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                {monthWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b border-border/40 last:border-b-0">
                    {week.map((day) => {
                      const dayItems = itemsByDay.get(day) ?? [];
                      const today = isToday(day);
                      const inMonth = day.substring(0, 7) === `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
                      const isDragTarget = dragOverDate === day;
                      const dayNum = parseInt(day.split("-")[2], 10);

                      return (
                        <div
                          key={day}
                          className={cn(
                            "border-r border-border/40 p-1 transition-colors last:border-r-0",
                            gridConfig.cellHeightClass,
                            !inMonth && "bg-bg-hover/10",
                            today && "bg-primary/[0.04]",
                            isDragTarget && "bg-primary/10 ring-2 ring-inset ring-primary/40"
                          )}
                          onDragOver={(e) => handleDragOver(e, day)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day)}
                        >
                          {/* Day number */}
                          <div className="mb-0.5 flex justify-end">
                            <span
                              className={cn(
                                "flex items-center justify-center rounded-full font-bold",
                                gridConfig.dayNumberClass,
                                today
                                  ? "bg-primary text-white"
                                  : inMonth
                                    ? "text-text-primary"
                                    : "text-text-muted"
                              )}
                            >
                              {dayNum}
                            </span>
                          </div>

                          {/* Activity bars */}
                          {dayItems.length > 0 && (
                            <div className="space-y-0.5 overflow-hidden">
                              {dayItems.slice(0, scale === "single" ? 3 : 1).map((item) => {
                                const isOverdue =
                                  !item.isCompleted &&
                                  Boolean(item.scheduledAt && new Date(item.scheduledAt) < new Date());
                                return (
                                  <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => router.push(`/activities/${item.id}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        router.push(`/activities/${item.id}`);
                                      }
                                    }}
                                    title={`${item.title}\n${ACTIVITY_TYPE_LABELS[item.type]}${item.customer ? " · " + item.customer.name : ""}`}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 leading-tight transition-all hover:brightness-95 focus:outline-none focus:ring-1 focus:ring-primary/40",
                                      gridConfig.activityClass,
                                      ACTIVITY_TYPE_BAR[item.type],
                                      item.isCompleted && "opacity-50 line-through",
                                      draggedItem?.id === item.id && "opacity-30"
                                    )}
                                  >
                                    <span className={cn("shrink-0 rounded-full", ACTIVITY_TYPE_DOT[item.type], {
                                      "h-1 w-1": scale === "single",
                                      "h-0.5 w-0.5": scale !== "single"
                                    })} />
                                    <span className="truncate flex-1">
                                      {scale === "single" && item.scheduledAt ? `${formatTimeShort(item.scheduledAt)} ` : ""}
                                      {item.title}
                                    </span>
                                  </div>
                                );
                              })}
                              {dayItems.length > (scale === "single" ? 3 : 1) && (
                                <p className={cn("px-1 font-semibold text-text-secondary", gridConfig.activityClass)}>
                                  +{dayItems.length - (scale === "single" ? 3 : 1)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="border-t border-border/50 p-6">
            <EmptyState
              title="Không có công việc trong tháng này"
              description="Nới bộ lọc hoặc chuyển sang tháng khác để xem thêm activity."
            />
          </div>
        )}
      </CardContent>

      {/* Reschedule modal */}
      {rescheduleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRescheduleDialog(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-bg-card shadow-xl">
            <div className="space-y-6 p-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Dời lịch công việc</h2>
                <p className="mt-1 text-sm text-text-secondary">{rescheduleDialog.activityTitle}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">Ngày cũ</label>
                  <div className="rounded-md bg-bg-hover/70 px-3 py-2 text-sm text-text-secondary">
                    {formatDate(rescheduleDialog.oldDate)} · {rescheduleDialog.oldTime}
                  </div>
                </div>
                <div>
                  <label htmlFor="m-new-date" className="mb-2 block text-sm font-medium text-text-primary">Ngày mới</label>
                  <input
                    id="m-new-date"
                    type="date"
                    value={rescheduleDialog.newDate}
                    onChange={(e) => setRescheduleDialog({ ...rescheduleDialog, newDate: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="m-new-time" className="mb-2 block text-sm font-medium text-text-primary">Giờ mới</label>
                  <input
                    id="m-new-time"
                    type="time"
                    value={rescheduleDialog.newTime}
                    onChange={(e) => setRescheduleDialog({ ...rescheduleDialog, newTime: e.target.value })}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="rounded-md bg-info-bg/70 p-3 text-xs text-info">
                  Sẽ dời từ {formatDate(rescheduleDialog.oldDate)} {rescheduleDialog.oldTime} →{" "}
                  {formatDate(rescheduleDialog.newDate)} {rescheduleDialog.newTime}
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setRescheduleDialog(null)} disabled={updateMutation.isPending} className="flex-1">
                  Huỷ
                </Button>
                <Button type="button" onClick={handleConfirmReschedule} disabled={updateMutation.isPending} className="flex-1">
                  {updateMutation.isPending ? "Đang lưu..." : "Xác nhận"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
