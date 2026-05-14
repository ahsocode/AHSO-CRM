"use client";

import { usePathname } from "next/navigation";
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
import { useSessions, useTerminateSession } from "@/hooks/use-sessions";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { getRoleLabel, getSessionId, resolveAssetUrl } from "@/lib/auth";
import { AuthUser, RealtimeEvent, UserSessionInfo } from "@/lib/types";

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

function getTopbarContext(pathname: string) {
  if (pathname.startsWith("/customers")) return { area: "CRM", current: "Khách hàng" };
  if (pathname.startsWith("/projects")) return { area: "CRM", current: "Dự án" };
  if (pathname.startsWith("/quotes")) return { area: "CRM", current: "Báo giá" };
  if (pathname.startsWith("/contracts")) return { area: "CRM", current: "Hợp đồng" };
  if (pathname.startsWith("/calendar")) return { area: "Công việc", current: "Lịch" };
  if (pathname.startsWith("/reports")) return { area: "Phân tích", current: "Báo cáo" };
  if (pathname.startsWith("/admin")) return { area: "Hệ thống", current: "Quản trị" };
  if (pathname.startsWith("/users")) return { area: "Hệ thống", current: "Người dùng" };
  return { area: "Tổng quan", current: "Dashboard" };
}

function getSessionDevice(session: UserSessionInfo) {
  return session.device ?? session.deviceName ?? "Trình duyệt";
}

function getSessionIp(session: UserSessionInfo) {
  return session.ip ?? session.ipAddress ?? "Không rõ IP";
}

function getSessionLastUsed(session: UserSessionInfo) {
  return session.lastUsed ?? session.lastActiveAt ?? session.createdAt;
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
  const pathname = usePathname();
  const sessionsQuery = useSessions();
  const terminateSessionMutation = useTerminateSession();
  const { error: showError, success } = useToast();
  const currentSessionId = getSessionId();
  const sessions = sessionsQuery.data ?? [];
  const currentSession =
    sessions.find((session) => session.current || session.id === currentSessionId) ?? sessions[0] ?? null;
  const context = getTopbarContext(pathname);

  const openCommandPalette = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new Event("ahso:open-command-palette"));
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-4 border-b border-border-light bg-white/92 px-4 shadow-[0_1px_8px_rgba(0,59,90,0.05)] backdrop-blur-xl print:hidden md:px-6">
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{context.area}</span>
        <AppIcon name="chevron-down" className="h-3 w-3 -rotate-90 text-text-muted" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{context.current}</span>
      </div>

      <div className="relative min-w-0 flex-1 max-w-[520px]">
        <AppIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
        />
        <Input
          readOnly
          className="h-9 rounded-lg border-border bg-bg-subtle pl-9 pr-12 text-[13.5px] text-text-secondary focus:border-primary-light"
          onClick={openCommandPalette}
          onFocus={openCommandPalette}
          placeholder="Tìm kiếm khách hàng, dự án, báo giá..."
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-bg-hover px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden lg:block">
          <RealtimeIndicator isConnected={isRealtimeConnected} lastEvent={lastRealtimeEvent} />
        </div>
        <NotificationBell />

        <div className="h-6 w-px bg-border-light" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 rounded-lg bg-bg-subtle px-2 py-1.5 transition hover:bg-bg-hover"
              type="button"
            >
              <AvatarInitials
                className="h-8 w-8 rounded-full bg-primary-bg text-xs text-primary"
                name={user?.name ?? "AHSO CRM"}
                src={resolveAssetUrl(user?.avatarUrl)}
              />
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold leading-tight text-text-primary">{user?.name ?? "Đang tải..."}</p>
                <p className="text-xs text-text-secondary">{getRoleLabel(user?.role)}</p>
              </div>
              <AppIcon name="chevron-down" className="h-4 w-4 text-text-secondary" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[420px] max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <div className="px-2 py-1.5">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">PHIÊN HIỆN TẠI</p>
              {currentSession ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <AppIcon name="monitor" className="h-3.5 w-3.5 shrink-0" />
                    <span>{getSessionDevice(currentSession)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AppIcon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
                    <span>{getSessionIp(currentSession)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AppIcon name="clock" className="h-3.5 w-3.5 shrink-0" />
                    <span>Hoạt động cuối {formatDate(getSessionLastUsed(currentSession))}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Đang tải thông tin phiên...</p>
              )}
            </div>

            <DropdownMenuSeparator />

            <div className="px-2 py-1.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">PHIÊN ĐĂNG NHẬP</p>
                {sessionsQuery.isFetching ? (
                  <span className="text-[11px] text-muted-foreground">Đang đồng bộ...</span>
                ) : null}
              </div>

              {sessionsQuery.isLoading ? (
                <p className="rounded-xl bg-bg-hover px-3 py-3 text-xs text-muted-foreground">
                  Đang tải danh sách phiên...
                </p>
              ) : sessions.length ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {sessions.map((session) => {
                    const isCurrentSession = Boolean(
                      session.current ||
                        session.id === currentSessionId ||
                        (!currentSessionId && session.id === currentSession?.id)
                    );

                    return (
                      <div key={session.id} className="rounded-xl border border-border-light bg-bg-subtle px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-text-primary">
                                {getSessionDevice(session)}
                              </p>
                              {isCurrentSession ? (
                                <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
                                  Hiện tại
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">IP: {getSessionIp(session)}</p>
                            <p className="text-xs text-muted-foreground">
                              Hoạt động cuối: {formatDate(getSessionLastUsed(session))}
                            </p>
                          </div>

                          {!isCurrentSession ? (
                            <button
                              type="button"
                              disabled={terminateSessionMutation.isPending}
                              className="shrink-0 rounded-lg border border-danger/20 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                terminateSessionMutation.mutate(session.id, {
                                  onSuccess: () => success("Đã đăng xuất thiết bị."),
                                  onError: (error) =>
                                    showError(getApiErrorMessage(error, "Không thể đăng xuất thiết bị này."))
                                });
                              }}
                            >
                              Đăng xuất thiết bị này
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-bg-hover px-3 py-3 text-xs text-muted-foreground">
                  Chưa có phiên đăng nhập nào.
                </p>
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
    </header>
  );
}
