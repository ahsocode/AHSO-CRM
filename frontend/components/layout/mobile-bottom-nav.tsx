"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/shared/app-icon";
import { useAuthStore } from "@/hooks/use-auth";
import { getAuthRoleName } from "@/lib/auth";
import { cn } from "@/lib/utils";

const MOBILE_ITEMS = [
  { href: "/dashboard" as Route, label: "Dashboard", icon: "dashboard" as const },
  { href: "/customers" as Route, label: "Khách hàng", icon: "groups" as const },
  { href: "/projects" as Route, label: "Dự án", icon: "factory" as const },
  { href: "/activities" as Route, label: "Hoạt động", icon: "history" as const },
  { href: "/calendar" as Route, label: "Lịch", icon: "calendar" as const }
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const roleName = getAuthRoleName(user?.role);
  const items =
    roleName === "ADMIN"
      ? [...MOBILE_ITEMS, { href: "/admin" as Route, label: "Quản trị", icon: "settings" as const }]
      : MOBILE_ITEMS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/96 px-2 pt-2 shadow-[0_-10px_30px_rgba(21,67,96,0.12)] backdrop-blur-xl print:hidden md:hidden"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      <div className={cn("grid gap-1", roleName === "ADMIN" ? "grid-cols-6" : "grid-cols-5")}>
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition",
                isActive ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-bg-hover"
              )}
            >
              <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
