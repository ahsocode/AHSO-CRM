"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useGlobalSearch } from "@/hooks/use-search";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { SearchResultItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ahso_recent_searches";
const OPEN_EVENT = "ahso:open-command-palette";

const QUICK_ACTIONS: SearchResultItem[] = [
  { id: "dashboard", type: "activity", title: "Đi đến Dashboard", subtitle: "Tổng quan hệ thống", href: "/dashboard" },
  { id: "new-customer", type: "customer", title: "Tạo khách hàng mới", subtitle: "Mở form khách hàng", href: "/customers/new" },
  { id: "new-project", type: "project", title: "Tạo dự án mới", subtitle: "Mở form dự án", href: "/projects/new" },
  { id: "new-quote", type: "quote", title: "Tạo báo giá mới", subtitle: "Mở form báo giá", href: "/quotes/new" }
];

function ResultRow({
  item,
  onSelect
}: {
  item: SearchResultItem;
  onSelect: (item: SearchResultItem) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-bg-hover"
      onClick={() => onSelect(item)}
    >
      <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
        <AppIcon
          name={
            item.type === "customer"
              ? "groups"
              : item.type === "project"
                ? "factory"
                : item.type === "quote"
                  ? "description"
                  : item.type === "contract"
                    ? "contract"
                    : "history"
          }
          className="h-4 w-4"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{item.title}</p>
        <p className="truncate text-xs text-text-secondary">{item.subtitle ?? "Đi đến chi tiết"}</p>
      </div>
      <AppIcon name="arrow-right" className="mt-1 h-4 w-4 text-text-muted" />
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const searchQuery = useGlobalSearch(debouncedQuery, 8, open);
  const [recent, setRecent] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    try {
      setRecent(JSON.parse(rawValue) as SearchResultItem[]);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    const openPalette = () => setOpen(true);
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    window.addEventListener(OPEN_EVENT, openPalette as EventListener);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener(OPEN_EVENT, openPalette as EventListener);
    };
  }, []);

  const displayedItems = useMemo(() => {
    if (debouncedQuery.trim().length >= 2) {
      return searchQuery.data ?? [];
    }

    return recent.length ? recent : QUICK_ACTIONS;
  }, [debouncedQuery, recent, searchQuery.data]);

  const handleSelect = (item: SearchResultItem) => {
    const nextRecent = [item, ...recent.filter((candidate) => candidate.href !== item.href)].slice(0, 6);
    setRecent(nextRecent);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecent));
    setOpen(false);
    setQuery("");
    router.push(item.href as Route);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/35 px-4 pt-[12vh] backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(21,67,96,0.2)]">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4">
          <AppIcon name="search" className="h-5 w-5 text-primary" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
            placeholder="Tìm khách hàng, dự án, báo giá hoặc dùng hành động nhanh..."
          />
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Esc
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {searchQuery.isLoading && debouncedQuery.trim().length >= 2 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <LoadingSkeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : displayedItems.length > 0 ? (
            <div className="space-y-1">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                {debouncedQuery.trim().length >= 2 ? "Kết quả tìm kiếm" : recent.length ? "Gần đây" : "Hành động nhanh"}
              </div>
              {displayedItems.map((item) => (
                <ResultRow key={`${item.type}-${item.id}`} item={item} onSelect={handleSelect} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-bg-hover/40 p-10 text-center">
              <p className="font-semibold text-text-primary">Không tìm thấy kết quả phù hợp</p>
              <p className="mt-2 text-sm text-text-secondary">Thử với từ khóa ngắn hơn hoặc dùng hành động nhanh phía dưới.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-4 text-xs text-text-secondary">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-bg-hover px-2 py-1 font-semibold text-text-primary">⌘K</span>
            <span>hoặc</span>
            <span className="rounded-md bg-bg-hover px-2 py-1 font-semibold text-text-primary">Ctrl K</span>
            <span>để mở nhanh</span>
          </div>
          <Link href="/dashboard" className={cn("font-semibold text-primary hover:underline")} onClick={() => setOpen(false)}>
            Về dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
