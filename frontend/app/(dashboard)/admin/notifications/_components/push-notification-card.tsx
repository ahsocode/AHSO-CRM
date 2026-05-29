"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/shared/app-icon";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function PushNotificationCard() {
  const {
    isSupported,
    isConfigured,
    hasCheckedSupport,
    isSubscribed,
    isBusy,
    permission,
    canPrompt,
    unavailableReason,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  if (!hasCheckedSupport) return null;

  return (
    <Card className="border border-white/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                isSubscribed
                  ? "bg-success-bg text-success"
                  : "bg-bg-hover text-text-muted"
              )}
            >
              <AppIcon name="bell" className="text-[20px]" />
            </span>
            <div>
              <p className="font-semibold text-text-primary">
                Thông báo đẩy trên thiết bị này
              </p>
              <p className="mt-0.5 text-sm text-text-secondary">
                {unavailableReason ? (
                  <span className="text-warning">{unavailableReason}</span>
                ) : isSubscribed ? (
                  "✅ Đang nhận thông báo — deal mới, milestone, thanh toán"
                ) : (
                  "Nhận thông báo ngay trên trình duyệt/desktop khi có cập nhật quan trọng"
                )}
              </p>
            </div>
          </div>

          {canPrompt || isSubscribed ? (
            <Button
              type="button"
              size="sm"
              variant={isSubscribed ? "outline" : "primary"}
              disabled={isBusy}
              onClick={isSubscribed ? unsubscribe : subscribe}
              className="shrink-0"
            >
              {isBusy
                ? "Đang xử lý..."
                : isSubscribed
                  ? "Tắt thông báo"
                  : "Bật thông báo"}
            </Button>
          ) : (
            !isConfigured && (
              <span className="shrink-0 rounded-full bg-warning-bg px-3 py-1 text-xs font-medium text-warning">
                Chưa cấu hình VAPID
              </span>
            )
          )}
        </div>

        {permission === "denied" && (
          <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            Trình duyệt đang <strong>chặn</strong> quyền thông báo. Vào cài đặt trình duyệt → Site settings → Notifications → Allow.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
