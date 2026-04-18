"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContentArea } from "@/components/layout/content-area";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { getAccessToken, getRefreshToken } from "@/lib/auth";
import { useAuthStore } from "@/hooks/use-auth";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const logout = useAuthStore((state) => state.logout);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let isCancelled = false;

    async function ensureSession() {
      const hasAccessToken = Boolean(getAccessToken());
      const hasRefreshToken = Boolean(getRefreshToken());

      if (!hasAccessToken && !hasRefreshToken) {
        router.replace("/login");
        return;
      }

      if (!hasAccessToken && hasRefreshToken) {
        try {
          await refreshSession();
        } catch {
          router.replace("/login");
          return;
        }
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
  }, [isHydrated, refreshSession, router]);

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
        <Topbar user={user} onLogout={logout} />
        <ContentArea>{children}</ContentArea>
      </div>
    </div>
  );
}

