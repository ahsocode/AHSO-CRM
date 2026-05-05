"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { RealtimeEvent } from "@/lib/types";

export function RealtimeIndicator({
  isConnected,
  lastEvent
}: {
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
}) {
  const [isFresh, setIsFresh] = useState(false);

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    setIsFresh(true);
    const timeout = window.setTimeout(() => setIsFresh(false), 8_000);
    return () => window.clearTimeout(timeout);
  }, [lastEvent]);

  const label = isFresh
    ? "Đang có cập nhật..."
    : isConnected
      ? "Realtime đang hoạt động"
      : "Đang chờ kết nối realtime";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        isFresh
          ? "border-primary/30 bg-primary/10 text-primary"
          : isConnected
            ? "border-success/20 bg-success-bg/70 text-success"
            : "border-warning/20 bg-warning-bg/70 text-warning"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isFresh ? "bg-primary animate-pulse" : isConnected ? "bg-success" : "bg-warning"
        )}
      />
      <span>{label}</span>
    </div>
  );
}
