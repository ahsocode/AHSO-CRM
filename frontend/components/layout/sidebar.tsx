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
    <aside className="hide-scrollbar w-full overflow-x-auto border-b border-border-light bg-white/92 text-text-primary shadow-[1px_0_12px_rgba(0,59,90,0.06)] backdrop-blur-xl print:hidden md:sticky md:top-0 md:flex md:h-screen md:w-[220px] md:min-w-[220px] md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="flex h-14 items-center gap-3 px-4 md:border-b md:border-border-light">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(0,59,90,0.30)]">
          A
        </div>
        <div className="min-w-0">
          <div className="font-heading text-sm font-bold leading-tight tracking-[-0.02em] text-text-primary">AHSO CRM</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">Automation Hub</div>
        </div>
      </div>

      <nav className="flex min-w-max gap-2 px-3 py-3 md:min-w-0 md:flex-col md:gap-1">
        <p className="hidden px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted md:block">
          Menu chính
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 md:mx-0",
                isActive
                  ? "border-primary bg-primary-bg text-primary"
                  : "border-transparent text-text-secondary hover:bg-bg-subtle hover:text-primary-mid"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-all",
                  isActive
                    ? "bg-primary text-white"
                    : "bg-bg-hover text-text-secondary group-hover:text-primary-mid"
                )}
              >
                <AppIcon name={item.icon} className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="block whitespace-nowrap">{item.label}</span>
                <span className={cn("mt-0.5 hidden text-[10.5px] leading-none md:block", isActive ? "text-primary/70" : "text-text-muted")}>
                  {getItemHint(item.href)}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="hidden px-3 pb-4 md:mt-auto md:block">
        <div className="mb-3 h-px bg-border-light" />
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-bg-subtle">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-bg text-xs font-bold text-primary">
            {(user?.name ?? "AHSO")
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-text-primary">{user?.name ?? "AHSO CRM"}</p>
            <p className="text-[11px] text-text-muted">{roleName ?? "Người dùng"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
