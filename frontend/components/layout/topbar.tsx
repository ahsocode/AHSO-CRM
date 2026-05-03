"use client";

import Image from "next/image";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { AppIcon } from "@/components/shared/app-icon";
import { NotificationBell } from "@/components/layout/notification-bell";
import { RealtimeIndicator } from "@/components/layout/realtime-indicator";
import { useCompanyInfo, useLogo } from "@/hooks/use-settings";
import { useSessions } from "@/hooks/use-sessions";
import { getRoleLabel, resolveAssetUrl } from "@/lib/auth";
import { AuthUser, RealtimeEvent } from "@/lib/types";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function Topbar({
  user,
  onLogout,
  isRealtimeConnected,
  lastRealtimeEvent
}: {
  user: AuthUser | null;
  onLogout: () => Promise<void>;
  isRealtimeConnected: boolean;
  lastRealtimeEvent: RealtimeEvent | null;
}) {
  const companyQuery = useCompanyInfo();
  const logoQuery = useLogo();
  const sessionsQuery = useSessions();
  const brandName = companyQuery.data?.shortName || companyQuery.data?.name || "AHSO";
  const logoUrl = resolveAssetUrl(logoQuery.data);
  const currentSession = sessionsQuery.data?.[0] ?? null;

  const openCommandPalette = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new Event("ahso:open-command-palette"));
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/78 px-4 py-4 shadow-[0_12px_36px_rgba(21,67,96,0.06)] backdrop-blur-xl print:hidden md:px-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={brandName}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="font-heading text-sm font-extrabold tracking-[0.22em] text-primary">AHSO</span>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">{brandName}</p>
              <p className="mt-1 text-sm text-text-secondary">
                {companyQuery.data?.taxId ? `MST ${companyQuery.data.taxId}` : "Bảng điều phối vận hành CRM cho đội kinh doanh kỹ thuật."}
              </p>
            </div>
          </div>

          <div className="relative w-full max-w-2xl">
            <AppIcon
              name="search"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/65"
            />
            <Input
              readOnly
              className="h-12 rounded-full border-slate-200 bg-white/92 pl-11 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-primary/50"
              onClick={openCommandPalette}
              onFocus={openCommandPalette}
              placeholder="Tìm kiếm khách hàng, dự án, báo giá... (⌘K)"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/92 px-2 py-1.5 shadow-sm transition hover:border-primary/25 hover:bg-white"
                type="button"
              >
                <AvatarInitials className="h-10 w-10 rounded-full bg-primary/12 text-xs text-primary" name={user?.name ?? "AHSO CRM"} />
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold text-text-primary">{user?.name ?? "Đang tải..."}</p>
                  <p className="text-xs text-text-secondary">{getRoleLabel(user?.role)}</p>
                </div>
                <AppIcon name="chevron-down" className="h-4 w-4 text-text-secondary" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <div className="px-2 py-1.5">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">PHIÊN ĐĂNG NHẬP HIỆN TẠI</p>
                {currentSession ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <AppIcon name="monitor" className="h-3.5 w-3.5 shrink-0" />
                      <span>{currentSession.deviceName ?? "Trình duyệt"}</span>
                    </div>
                    {currentSession.ipAddress && (
                      <div className="flex items-center gap-1.5">
                        <AppIcon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
                        <span>{currentSession.ipAddress}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <AppIcon name="clock" className="h-3.5 w-3.5 shrink-0" />
                      <span>Đăng nhập lúc {formatDate(currentSession.createdAt)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Đang tải thông tin phiên...</p>
                )}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => void onLogout()}
              >
                <AppIcon name="logout" className="mr-2 h-4 w-4" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

        <div className="flex items-center justify-between gap-3">
          <RealtimeIndicator isConnected={isRealtimeConnected} lastEvent={lastRealtimeEvent} />
          <p className="hidden text-xs text-text-secondary md:block">
            Hệ thống sẽ tự làm mới dữ liệu khi có thay đổi mới từ các tab hoặc đồng đội.
          </p>
        </div>
      </div>
    </header>
  );
}
