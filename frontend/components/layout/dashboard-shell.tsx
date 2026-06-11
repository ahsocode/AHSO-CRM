"use client";

import { useCallback, useEffect, useState } from "react";
import { ContentArea } from "@/components/layout/content-area";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/shared/command-palette";
import { GlobalShortcuts } from "@/components/shared/global-shortcuts";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { getAccessToken } from "@/lib/auth";
import { useAuthStore } from "@/hooks/use-auth";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useWebsocket } from "@/hooks/use-websocket";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const logout = useAuthStore((state) => state.logout);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isActive = isHydrated && !isCheckingAuth;

  const realtime = useWebsocket(isActive);

  // Auto-logout after 15 minutes of inactivity
  const handleIdleTimeout = useCallback(() => {
    void logout();
  }, [logout]);
  useIdleTimeout(handleIdleTimeout, isActive);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let isCancelled = false;

    async function ensureSession() {
      const hasAccessToken = Boolean(getAccessToken());

      // No access token means this is a new browser session.
      // Do NOT auto-refresh via cookie — require explicit login.
      if (!hasAccessToken) {
        await logout();
        return;
      }

      if (!isCancelled) {
        setIsCheckingAuth(false);
      }
    }

    if (isHydrated) {
      void ensureSession();
    }

    return () => {
      isCancelled = true;
    };
  }, [isHydrated, logout]);

  if (!isHydrated || isCheckingAuth) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xl space-y-4">
          <LoadingSkeleton className="h-8 w-40" />
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell md:flex">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          onLogout={logout}
          isRealtimeConnected={realtime.isConnected}
          lastRealtimeEvent={realtime.lastEvent}
        />
        <ContentArea>{children}</ContentArea>
      </div>
      <CommandPalette />
      <GlobalShortcuts />
      <MobileBottomNav />
    </div>
  );
}
