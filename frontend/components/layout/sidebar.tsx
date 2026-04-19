"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuthStore } from "@/hooks/use-auth";
import { getAuthRoleName } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/shared/app-icon";

function getItemHint(href: string) {
  if (href === "/dashboard") {
    return "Tổng quan điều phối";
  }

  if (href === "/customers") {
    return "Lead và khách hàng";
  }

  if (href === "/projects") {
    return "Cơ hội và triển khai";
  }

  if (href === "/quotes") {
    return "Bản chào giá thương mại";
  }

  if (href === "/contracts") {
    return "Tiến độ hợp đồng";
  }

  if (href === "/calendar") {
    return "Lịch hẹn và công việc";
  }

  if (href === "/reports") {
    return "Phân tích vận hành";
  }

  if (href === "/admin") {
    return "Cấu hình hệ thống";
  }

  return "Quyền truy cập nội bộ";
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const roleName = getAuthRoleName(user?.role);
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.href === "/users" && roleName === "STAFF") {
      return false;
    }

    return true;
  });
  const navItems =
    roleName === "ADMIN"
      ? [...visibleItems, { href: "/admin" as Route, label: "Quản trị", icon: "settings" as const }]
      : visibleItems;

  return (
    <aside className="hide-scrollbar w-full overflow-x-auto border-b border-slate-200/80 bg-white/92 px-4 py-5 text-text-primary shadow-[0_18px_48px_rgba(21,67,96,0.08)] backdrop-blur-xl print:hidden md:sticky md:top-0 md:h-screen md:w-[260px] md:min-w-[260px] md:border-b-0 md:border-r">
      <div className="rounded-[24px] border border-slate-200/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-center gap-3 md:px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-light text-white shadow-[0_12px_24px_rgba(26,82,118,0.28)]">
            <span className="font-heading text-lg font-extrabold">A</span>
          </div>
          <div>
            <div className="font-heading text-lg font-bold text-text-primary">AHSO CRM</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-text-secondary">Automation Hub</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary/10 via-info-bg/60 to-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/80">Sales Console</p>
          <p className="mt-2 text-sm font-medium text-text-primary">
            Giúp quản lý công việc tốt hơn.
          </p>
        </div>
      </div>

      <nav className="mt-6 flex min-w-max gap-2 pb-1 md:min-w-0 md:flex-col md:gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={cn(
                "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-white to-info-bg/70 text-primary shadow-[0_10px_24px_rgba(26,82,118,0.14)] ring-1 ring-primary/25"
                  : "text-slate-600 hover:bg-white hover:text-primary hover:shadow-[0_10px_20px_rgba(21,67,96,0.08)]"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                  isActive
                    ? "bg-primary text-white shadow-[0_10px_18px_rgba(26,82,118,0.22)]"
                    : "bg-slate-100 text-slate-500 group-hover:bg-primary/12 group-hover:text-primary"
                )}
              >
                <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="block whitespace-nowrap">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] leading-none",
                    isActive ? "text-primary/70" : "text-text-muted group-hover:text-primary/65"
                  )}
                >
                  {getItemHint(item.href)}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
