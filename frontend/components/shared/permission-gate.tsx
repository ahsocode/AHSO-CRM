"use client";

import { useAuthStore } from "@/hooks/use-auth";

export function usePermission(permission: string) {
  return useAuthStore((state) => state.hasPermission(permission));
}

export function PermissionGate({
  permission,
  fallback = null,
  children
}: {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const allowed = usePermission(permission);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
