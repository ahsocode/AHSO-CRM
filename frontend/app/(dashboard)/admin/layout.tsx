"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { useAuthStore } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getAuthRoleName } from "@/lib/auth";

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { error } = useToast();
  const user = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hasRedirected = useRef(false);
  const roleName = getAuthRoleName(user?.role);
  const isAdmin = roleName === "ADMIN";

  useEffect(() => {
    if (!isHydrated || !user || isAdmin || hasRedirected.current) {
      return;
    }

    hasRedirected.current = true;
    error("Không có quyền truy cập");
    router.replace("/dashboard");
  }, [error, isAdmin, isHydrated, router, user]);

  if (!isHydrated || !user || !isAdmin) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
