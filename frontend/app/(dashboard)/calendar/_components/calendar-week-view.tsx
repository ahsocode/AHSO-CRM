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

const WEEKDAY_SHORT_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const ACTIVITY_TYPE_COLORS: Record<ActivityType, string> = {
  CALL: "bg-info-bg text-info border-info/30",
  EMAIL: "bg-slate-100 text-slate-700 border-slate-300",
  MEETING: "bg-primary/10 text-primary border-primary/30",
  SURVEY: "bg-warning-bg text-warning border-warning/30",
  DEMO: "bg-success-bg text-success border-success/30",
  NOTE: "bg-slate-100 text-slate-700 border-slate-300",
  FOLLOWUP: "bg-warning-bg text-warning border-warning/30"
};

function getDaysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const current = new Date(start);

  while (current <= end) {
    days.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(
        current.getDate()
      ).padStart(2, "0")}`
    );
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function groupItemsByDay(items: CalendarEventItem[]): Map<string, CalendarEventItem[]> {
  const groups = new Map<string, CalendarEventItem[]>();

  for (const item of items) {
    const d = new Date(item.anchorAt);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const existing = groups.get(dayKey) ?? [];
    existing.push(item);
    groups.set(dayKey, existing);
  }

  for (const [key, dayItems] of groups) {
    groups.set(
      key,
      dayItems.sort(
        (a, b) => new Date(a.anchorAt).getTime() - new Date(b.anchorAt).getTime()
      )
    );
  }

  return groups;
}

function formatDayNumber(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return String(d.getDate());
}

function formatMonthShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `Th${d.getMonth() + 1}`;
}

function getWeekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const dayIndex = (d.getDay() + 6) % 7; // 0 = Monday
  return WEEKDAY_SHORT_VI[dayIndex];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(dateStr: string): boolean {
  return isSameDay(new Date(`${dateStr}T00:00:00`), new Date());
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function formatTimeShort(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatRangeLabel(dateFrom: string, dateTo: string): string {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  const fromMonth = from.getMonth();
  const toMonth = to.getMonth();

  if (from.getFullYear() !== to.getFullYear()) {
    return `${formatDate(dateFrom)} → ${formatDate(dateTo)}`;
  }

  if (fromMonth === toMonth) {
    return `Th${fromMonth + 1}/${from.getFullYear()} · ${from.getDate()} → ${to.getDate()}`;
  }

  return `${from.getDate()} Th${fromMonth + 1} → ${to.getDate()} Th${toMonth + 1}/${from.getFullYear()}`;
}

interface RescheduleState {
  activityId: string;
  activityTitle: string;
  oldDate: string;
  newDate: string;
  oldTime: string;
  newTime: string;
}

export function CalendarWeekView({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  dateFrom,
  dateTo,
  onDateRangeChange
}: {
  items: CalendarEventItem[];
  meta?: CalendarListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  dateFrom: string;
  dateTo: string;
  onDateRangeChange: (from: string, to: string) => void;
}) {
  const router = useRouter();
  const [draggedItem, setDraggedItem] = useState<CalendarEventItem | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [rescheduleDialog, setRescheduleDialog] = useState<RescheduleState | null>(null);
  const updateMutation = useUpdateActivity();

  const days = getDaysInRange(dateFrom, dateTo);
  const itemsByDay = groupItemsByDay(items);

  const handleDragStart = (e: React.DragEvent, item: CalendarEventItem) => {
    // Prevent click firing after drag
    e.stopPropagation();
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(item));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== date) {
      setDragOverDate(date);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the cell entirely (not moving to a child)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverDate(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!draggedItem) return;

    const oldDate = new Date(draggedItem.anchorAt);
    const oldDateStr = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, "0")}-${String(
      oldDate.getDate()
    ).padStart(2, "0")}`;

    if (oldDateStr === targetDate) {
      setDraggedItem(null);
      return;
    }

    const oldTime = draggedItem.scheduledAt
      ? formatTimeShort(draggedItem.scheduledAt)
      : "09:00";

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
    } catch (error) {
      console.error("Failed to reschedule:", error);
    }
  };

  const handleActivityClick = (item: CalendarEventItem) => {
    router.push(`/activities/${item.id}`);
  };

  const shiftRange = (deltaDays: number) => {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T00:00:00`);
    from.setDate(from.getDate() + deltaDays);
    to.setDate(to.getDate() + deltaDays);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    onDateRangeChange(fmt(from), fmt(to));
  };

  const handlePrevWeek = () => shiftRange(-7);
  const handleNextWeek = () => shiftRange(7);

  const handleToday = () => {
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayIndex);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    onDateRangeChange(fmt(start), fmt(end));
  };

  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="border-r border-b border-border/40 p-4">
                <LoadingSkeleton className="h-full min-h-[300px] w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardContent className="p-4">
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách công việc."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-white/70">
      <CardHeader className="mb-0 gap-2 border-b border-border/50 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
            Lịch công tác
          </p>
          <h2 className="font-heading text-xl font-bold text-text-primary">
            {formatRangeLabel(dateFrom, dateTo)}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {meta?.total ?? items.length} activity · Kéo thả giữa các ngày để dời lịch, click để sửa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevWeek}
            className="h-9 px-3"
            aria-label="Tuần trước"
          >
            <AppIcon name="arrow-left" className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={handleToday} className="h-9 px-4">
            Hôm nay
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleNextWeek}
            className="h-9 px-3"
            aria-label="Tuần sau"
          >
            <AppIcon name="arrow-right" className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border/50">
          {days.map((day) => {
            const today = isToday(day);
            const weekend = isWeekend(day);
            return (
              <div
                key={`h-${day}`}
                className={cn(
                  "flex flex-col items-center justify-center border-r border-border/50 px-3 py-3 last:border-r-0",
                  weekend && "bg-bg-hover/30",
                  today && "bg-primary/5"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.12em]",
                    today ? "text-primary" : "text-text-secondary"
                  )}
                >
                  {getWeekdayLabel(day)}
                </p>
                <div
                  className={cn(
                    "mt-1 flex h-9 w-9 items-center justify-center rounded-full text-base font-bold",
                    today ? "bg-primary text-white" : "text-text-primary"
                  )}
                >
                  {formatDayNumber(day)}
                </div>
                <p className="mt-1 text-[11px] text-text-muted">{formatMonthShort(day)}</p>
              </div>
            );
          })}
        </div>

        <div className="grid min-h-[520px] grid-cols-7">
          {days.map((day) => {
            const dayItems = itemsByDay.get(day) ?? [];
            const today = isToday(day);
            const weekend = isWeekend(day);
            const isDragTarget = dragOverDate === day;

            return (
              <div
                key={`col-${day}`}
                className={cn(
                  "flex flex-col gap-2 border-r border-border/50 p-2 transition-colors last:border-r-0",
                  weekend && "bg-bg-hover/20",
                  today && "bg-primary/[0.03]",
                  isDragTarget && "bg-primary/10 ring-2 ring-inset ring-primary/40"
                )}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                {dayItems.length === 0 ? (
                  <div className="flex min-h-[80px] flex-1 items-center justify-center">
                    <p className="text-center text-xs text-text-muted">Không có lịch</p>
                  </div>
                ) : (
                  dayItems.map((item) => {
                    const isOverdue =
                      !item.isCompleted &&
                      Boolean(
                        item.scheduledAt && new Date(item.scheduledAt).getTime() < Date.now()
                      );
                    const timeLabel = item.scheduledAt
                      ? formatTimeShort(item.scheduledAt)
                      : null;
                    const colorClass = ACTIVITY_TYPE_COLORS[item.type];

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleActivityClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleActivityClick(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "group cursor-pointer rounded-lg border-l-4 bg-white p-2 text-xs shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40",
                          colorClass,
                          item.isCompleted && "opacity-60",
                          draggedItem?.id === item.id && "opacity-40"
                        )}
                        title={`${item.title}\n${ACTIVITY_TYPE_LABELS[item.type]}${
                          item.customer ? ` · ${item.customer.name}` : ""
                        }${item.project ? ` · ${item.project.code}` : ""}`}
                      >
                        {timeLabel && (
                          <p className="font-bold leading-tight">{timeLabel}</p>
                        )}
                        <p className="mt-0.5 line-clamp-2 font-semibold leading-tight text-text-primary">
                          {item.title}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {ACTIVITY_TYPE_LABELS[item.type]}
                          </span>
                          {item.isCompleted && (
                            <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                              ✓
                            </Badge>
                          )}
                          {!item.isCompleted && isOverdue && (
                            <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                              Quá hạn
                            </Badge>
                          )}
                        </div>

                        {item.customer && (
                          <p className="mt-1 line-clamp-1 text-[11px] text-text-secondary">
                            <AppIcon name="groups" className="mr-1 inline h-3 w-3" />
                            {item.customer.name}
                          </p>
                        )}
                        {item.project && (
                          <p className="line-clamp-1 text-[11px] text-text-secondary">
                            <AppIcon name="briefcase" className="mr-1 inline h-3 w-3" />
                            {item.project.code}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="border-t border-border/50 p-6">
            <EmptyState
              title="Không có công việc trong khoảng đã chọn"
              description="Nới bộ lọc ngày hoặc trạng thái để xem thêm activity."
            />
          </div>
        )}
      </CardContent>

      {rescheduleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setRescheduleDialog(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-bg-card shadow-xl">
            <div className="space-y-6 p-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Dời lịch công việc</h2>
                <p className="mt-1 text-sm text-text-secondary">{rescheduleDialog.activityTitle}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">
                    Ngày cũ
                  </label>
                  <div className="rounded-md bg-bg-hover/70 px-3 py-2 text-sm text-text-secondary">
                    {formatDate(rescheduleDialog.oldDate)} · {rescheduleDialog.oldTime}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-date"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Ngày mới
                  </label>
                  <input
                    id="new-date"
                    type="date"
                    value={rescheduleDialog.newDate}
                    onChange={(e) =>
                      setRescheduleDialog({
                        ...rescheduleDialog,
                        newDate: e.target.value
                      })
                    }
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-time"
                    className="mb-2 block text-sm font-medium text-text-primary"
                  >
                    Giờ mới
                  </label>
                  <input
                    id="new-time"
                    type="time"
                    value={rescheduleDialog.newTime}
                    onChange={(e) =>
                      setRescheduleDialog({
                        ...rescheduleDialog,
                        newTime: e.target.value
                      })
                    }
                    className="w-full rounded-md border border-border px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="rounded-md bg-info-bg/70 p-3 text-xs text-info">
                  Sẽ dời từ {formatDate(rescheduleDialog.oldDate)} {rescheduleDialog.oldTime} →{" "}
                  {formatDate(rescheduleDialog.newDate)} {rescheduleDialog.newTime}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRescheduleDialog(null)}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  Huỷ
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmReschedule}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
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
