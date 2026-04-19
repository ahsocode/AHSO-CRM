"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-notifications";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [isRead, setIsRead] = useState("");
  const notificationsQuery = useNotifications({
    page,
    limit: PAGE_SIZE,
    type: type || undefined,
    isRead: isRead === "" ? undefined : isRead === "read"
  });
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const items = notificationsQuery.data?.items ?? [];
  const meta = notificationsQuery.data?.meta;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Thông báo"
        description="Danh sách cập nhật realtime dành riêng cho bạn, bao gồm báo giá, hợp đồng, hoạt động và nhắc hạn."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả loại</option>
              <option value="info">Info</option>
              <option value="success">Thành công</option>
              <option value="warning">Cảnh báo</option>
              <option value="error">Lỗi</option>
            </Select>
            <Select
              value={isRead}
              onChange={(event) => {
                setIsRead(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="unread">Chưa đọc</option>
              <option value="read">Đã đọc</option>
            </Select>
            <Button type="button" variant="outline" disabled={markAllMutation.isPending} onClick={() => void markAllMutation.mutateAsync()}>
              Đánh dấu đã đọc hết
            </Button>
          </div>
        }
      />

      <Card className="border border-white/70">
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Realtime Inbox</p>
            <CardTitle>Thông báo của bạn</CardTitle>
            <p className="mt-2 text-sm text-text-secondary">
              {meta?.total ?? 0} thông báo · {meta?.unreadCount ?? 0} chưa đọc
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={(meta?.page ?? 1) <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Trang trước
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={(meta?.page ?? 1) >= (meta?.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
            >
              Trang sau
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <LoadingSkeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Chưa có thông báo nào"
              description="Khi quote, hợp đồng hoặc công việc có cập nhật, hệ thống sẽ hiển thị tại đây."
            />
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-3xl border px-5 py-4 transition",
                    item.isRead ? "border-border/60 bg-white/80" : "border-primary/20 bg-primary/5"
                  )}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.type === "error" ? "danger" : item.type === "warning" ? "warning" : item.type === "success" ? "success" : "info"}>
                          {item.type}
                        </Badge>
                        {!item.isRead ? <Badge variant="neutral">Mới</Badge> : null}
                      </div>
                      <h2 className="font-heading text-xl font-bold text-text-primary">{item.title}</h2>
                      <p className="text-sm leading-6 text-text-secondary">{item.message}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                        <span>{formatDate(item.createdAt)}</span>
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!item.isRead ? (
                        <Button type="button" variant="outline" disabled={markReadMutation.isPending} onClick={() => void markReadMutation.mutateAsync(item.id)}>
                          Đánh dấu đã đọc
                        </Button>
                      ) : null}
                      {item.link ? (
                        <Link href={item.link as Route} className={cn(buttonVariants({ variant: "ghost" }))}>
                          <AppIcon name="arrow-right" className="h-4 w-4" />
                          Mở liên kết
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
