"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuthStore } from "@/hooks/use-auth";
import { getAuthRoleName } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { buildNavSections, isNavItemActive, NAV_COLLAPSED_STORAGE_KEY, toggleCollapsedSection } from "./nav-groups";
import { AppIcon } from "@/components/shared/app-icon";

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const roleName = getAuthRoleName(user?.role);
  // Nhớ nhóm đã thu gọn (localStorage, có try/catch trong hook).
  const [rawCollapsed, setCollapsed] = usePersistentState<string[]>(NAV_COLLAPSED_STORAGE_KEY, []);
  const collapsed = Array.isArray(rawCollapsed) ? rawCollapsed.filter((v) => typeof v === "string") : [];
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

  const sections = buildNavSections(navItems);
  const allHrefs = navItems.map((item) => item.href as string);

  return (
    <aside className="hidden bg-bg-card/95 text-text-primary shadow-sm backdrop-blur-xl print:hidden md:sticky md:top-0 md:flex md:h-screen md:w-[220px] md:min-w-[220px] md:flex-col md:overflow-y-auto">
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-md">
          <Image src="/crm-logo.png" alt="AHSO CRM" width={36} height={36} className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <div className="font-heading text-sm font-bold leading-tight tracking-[-0.02em] text-text-primary">AHSO CRM</div>
        </div>
      </div>

      <nav className="flex min-w-max gap-2 px-3 py-3 md:min-w-0 md:flex-col md:gap-1">
        {sections.map((section) => {
          const hasActive = section.items.some((item) => isNavItemActive(pathname, item.href, allHrefs));
          // A section holding the current page is never hidden.
          const isOpen = section.title === null || hasActive || !collapsed.includes(section.id);
          const listId = `nav-section-${section.id}`;

          return (
            <div key={section.id} className="md:flex md:flex-col md:gap-1">
              {section.title !== null ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() => setCollapsed((current) => toggleCollapsedSection(current, section.id))}
                  className="hidden w-full items-center justify-between rounded-md px-3 pb-1 pt-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted hover:text-primary-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:flex"
                >
                  {section.title}
                  <AppIcon name="chevron-down" className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                </button>
              ) : null}
              <div id={listId} hidden={!isOpen} className={cn("flex gap-2 md:flex-col md:gap-1", !isOpen && "md:hidden")}>
                {section.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href, allHrefs);

                  return (
                    <Link
                      key={item.href}
                      href={item.href as Route}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 md:mx-0",
                        isActive
                          ? "bg-primary-bg text-primary"
                          : "text-text-secondary hover:bg-bg-subtle hover:text-primary-mid"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md transition-all",
                          isActive
                            ? "bg-primary text-text-sidebar"
                            : "bg-bg-hover text-text-secondary group-hover:text-primary-mid"
                        )}
                      >
                        <AppIcon name={item.icon} className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="block whitespace-nowrap">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="hidden px-3 pb-4 md:mt-auto md:block">
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-bg-subtle px-3 py-2 transition hover:bg-bg-hover">
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
