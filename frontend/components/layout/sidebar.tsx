"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/shared/app-icon";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel hide-scrollbar w-full overflow-x-auto border-b border-white/70 bg-bg-sidebar/95 px-4 py-5 text-text-sidebar shadow-md print:hidden md:sticky md:top-0 md:h-screen md:w-[240px] md:min-w-[240px] md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 md:px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
          <span className="font-heading text-lg font-extrabold">A</span>
        </div>
        <div>
          <div className="font-heading text-lg font-bold">AHSO CRM</div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/60">Automation Hub</div>
        </div>
      </div>

      <nav className="mt-6 flex min-w-max gap-2 md:min-w-0 md:flex-col md:gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-white text-primary shadow-sm"
                  : "text-white/78 hover:bg-white/10 hover:text-white"
              )}
            >
              <AppIcon name={item.icon} className="h-[18px] w-[18px]" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
