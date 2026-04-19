"use client";

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppIcon } from "@/components/shared/app-icon";
import { useUnreadNotificationsCount } from "@/hooks/use-notifications";
import { NotificationDropdown } from "./notification-dropdown";

export function NotificationBell() {
  const unreadCountQuery = useUnreadNotificationsCount();
  const unreadCount = unreadCountQuery.data ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/92 text-text-secondary shadow-sm transition hover:border-primary/30 hover:text-primary"
          type="button"
          aria-label="Mở thông báo"
        >
          <AppIcon name="bell" className="h-[18px] w-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <NotificationDropdown />
    </DropdownMenu>
  );
}
