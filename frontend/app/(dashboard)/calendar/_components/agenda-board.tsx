"use client";

import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatRelativeTime, formatTime } from "@/lib/format";
import { CalendarEventItem, CalendarListMeta } from "@/lib/types";

function groupItemsByDay(items: CalendarEventItem[]) {
  const groups = new Map<string, CalendarEventItem[]>();

  for (const item of items) {
    const dayKey = new Date(item.anchorAt).toISOString().slice(0, 10);
    groups.set(dayKey, [...(groups.get(dayKey) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([date, dayItems]) => ({
    date,
    items: dayItems.sort(
      (left, right) => new Date(left.anchorAt).getTime() - new Date(right.anchorAt).getTime()
    )
  }));
}

export function AgendaBoard({
  items,
  meta,
  isLoading,
  isError,
  errorMessage,
  onPageChange
}: {
  items: CalendarEventItem[];
  meta?: CalendarListMeta;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onPageChange: (page: number) => void;
}) {
  if (isLoading) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-28 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-danger/20">
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
            {errorMessage ?? "Không thể tải danh sách công việc."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Không có công việc trong khoảng đã chọn"
            description="Nới bộ lọc ngày hoặc trạng thái để xem thêm activity."
          />
        </CardContent>
      </Card>
    );
  }

  const currentPage = meta?.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;
  const dayGroups = groupItemsByDay(items);
  const now = Date.now();

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Field Agenda</p>
          <CardTitle>Lịch công việc</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {meta?.total ?? items.length} activity, trang {currentPage}/{totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} variant="outline">
            Trang trước
          </Button>
          <Button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} variant="outline">
            Trang sau
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {dayGroups.map((group) => (
          <section key={group.date} className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <p className="font-heading text-xl font-bold text-text-primary">{formatDate(group.date)}</p>
                <p className="text-sm text-text-secondary">{group.items.length} activity</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                {new Date(group.date).toLocaleDateString("vi-VN", { weekday: "long" })}
              </p>
            </div>

            <div className="space-y-3">
              {group.items.map((item) => {
                const isOverdue =
                  !item.isCompleted &&
                  Boolean(item.scheduledAt && new Date(item.scheduledAt).getTime() < now);

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <AppIcon name="calendar" className="h-5 w-5" />
                          </div>
                          <p className="font-semibold text-text-primary">{item.title}</p>
                          <Badge variant="neutral">{ACTIVITY_TYPE_LABELS[item.type]}</Badge>
                          {item.isCompleted ? (
                            <Badge variant="success">Đã hoàn tất</Badge>
                          ) : isOverdue ? (
                            <Badge variant="danger">Quá hạn</Badge>
                          ) : (
                            <Badge variant="info">Đang mở</Badge>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                          <span>Phụ trách: {item.user.name}</span>
                          <span>•</span>
                          <span>
                            {item.scheduledAt
                              ? `Lịch: ${formatTime(item.scheduledAt)}`
                              : `Cập nhật: ${formatDateTime(item.updatedAt)}`}
                          </span>
                          <span>•</span>
                          <span>{formatRelativeTime(item.anchorAt)}</span>
                        </div>

                        {item.content ? (
                          <p className="mt-3 text-sm text-text-secondary">{item.content}</p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.customer ? (
                            <Link href={`/customers/${item.customer.id}`}>
                              <Badge variant="neutral">{item.customer.name}</Badge>
                            </Link>
                          ) : null}
                          {item.project ? (
                            <Link href={`/projects/${item.project.id}`} className="inline-flex items-center gap-2">
                              <Badge variant="info">{item.project.code}</Badge>
                            </Link>
                          ) : null}
                          {item.project ? <StatusBadge kind="project" status={item.project.status} /> : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-bg-hover/70 px-4 py-3 text-sm text-text-secondary lg:min-w-[220px]">
                        <p className="font-semibold text-text-primary">
                          {item.scheduledAt ? formatDateTime(item.scheduledAt) : formatDateTime(item.anchorAt)}
                        </p>
                        <p className="mt-1">
                          {item.doneAt
                            ? `Hoàn tất lúc ${formatDateTime(item.doneAt)}`
                            : item.isCompleted
                              ? "Đã đánh dấu hoàn tất"
                              : "Chưa hoàn tất"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
