"use client";

import { useState, useRef, useEffect } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { usePolicyItems } from "@/hooks/use-settings";
import { PolicyItemType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PolicyItemSelect({
  type,
  onSelect
}: {
  type: PolicyItemType;
  onSelect: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const query = usePolicyItems(type);
  const items = query.data ?? [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition"
      >
        <AppIcon name="description" className="h-3 w-3" />
        Chọn mẫu
        <AppIcon name="chevron-down" className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-white shadow-lg">
          <p className="border-b border-border-light px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {items.length} mẫu có sẵn
          </p>
          <div className="max-h-52 overflow-y-auto py-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-bg-subtle transition"
                onClick={() => {
                  onSelect(item.content);
                  setOpen(false);
                }}
              >
                <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                <span className="line-clamp-2 text-xs text-text-secondary">{item.content}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
