"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { formatRelativeTime } from "@/lib/format";
import { NotificationItem } from "@/lib/types";

function NotificationRow({
  item,
  onRead
}: {
  item: NotificationItem;
  onRead: (id: string, link?: string | null) => void;
}) {
  return (
    <DropdownMenuItem
      className="flex max-w-[360px] items-start gap-3 rounded-xl px-3 py-3"
      onSelect={(event) => {
        event.preventDefault();
        onRead(item.id, item.link);
      }}
    >
      <span
        className={`mt-1 h-2.5 w-2.5 rounded-full ${
          item.isRead ? "bg-slate-300" : item.type === "error" ? "bg-danger" : item.type === "warning" ? "bg-warning" : item.type === "success" ? "bg-success" : "bg-primary"
        }`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-semibold text-text-primary">{item.title}</p>
          <span className="shrink-0 text-[11px] text-text-muted">{formatRelativeTime(item.createdAt)}</span>
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{item.message}</p>
      </div>
    </DropdownMenuItem>
  );
}

export function NotificationDropdown() {
  const router = useRouter();
  const notificationsQuery = useNotifications({
    page: 1,
    limit: 8
  });
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();
  const pushNotifications = usePushNotifications();

  const handleRead = async (id: string, link?: string | null) => {
    await markReadMutation.mutateAsync(id);
    if (link) {
      router.push(link as Route);
    }
  };

  return (
    <DropdownMenuContent align="end" className="w-[380px] rounded-3xl border-slate-200/80 p-0 shadow-[0_20px_60px_rgba(21,67,96,0.15)]">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <DropdownMenuLabel className="px-0 text-base font-bold text-text-primary">Thông báo</DropdownMenuLabel>
            <p className="mt-1 text-xs text-text-secondary">Cập nhật realtime dành cho tài khoản của bạn.</p>
          </div>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={markAllMutation.isPending}
            onClick={() => void markAllMutation.mutateAsync()}
          >
            Đọc hết
          </Button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-3">
        {notificationsQuery.isLoading ? (
          <div className="space-y-3 p-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingSkeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : notificationsQuery.data?.items.length ? (
          <div className="space-y-2">
            {notificationsQuery.data.items.map((item) => (
              <NotificationRow key={item.id} item={item} onRead={handleRead} />
            ))}
          </div>
        ) : (
          <div className="p-1">
            <EmptyState
              title="Chưa có thông báo"
              description="Khi có cập nhật quan trọng về quote, hợp đồng hoặc công việc, bạn sẽ thấy tại đây."
            />
          </div>
        )}
      </div>

      <DropdownMenuSeparator />

      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <Button type="button" variant="ghost" onClick={() => router.push("/notifications")}>
          Xem tất cả
        </Button>
        {pushNotifications.isSupported ? (
          pushNotifications.isSubscribed ? (
            <Button type="button" variant="outline" disabled={pushNotifications.isBusy} onClick={() => void pushNotifications.unsubscribe()}>
              Tắt push
            </Button>
          ) : (
            <Button type="button" variant="primary" disabled={pushNotifications.isBusy || !pushNotifications.canPrompt} onClick={() => void pushNotifications.subscribe()}>
              Bật push
            </Button>
          )
        ) : null}
      </div>
    </DropdownMenuContent>
  );
}
