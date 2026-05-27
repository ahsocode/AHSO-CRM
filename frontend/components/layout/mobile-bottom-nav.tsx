"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/shared/app-icon";
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-white/96 px-1 pt-1.5 shadow-[0_-8px_24px_rgba(21,67,96,0.10)] backdrop-blur-xl print:hidden md:hidden"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-5">
        {MOBILE_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-text-muted hover:text-text-secondary"
              )}
            >
              {/* Icon with pill indicator for active state */}
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-2xl transition-all",
                  isActive ? "bg-primary/12" : ""
                )}
              >
                <AppIcon name={item.icon} className={cn("transition-all", isActive ? "text-[22px]" : "text-[20px]")} />
              </span>
              <span className="truncate leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
