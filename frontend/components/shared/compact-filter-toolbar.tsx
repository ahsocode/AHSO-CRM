"use client";

import type { HTMLInputTypeAttribute, ReactNode } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CompactFilterToolbar({
  children,
  canReset,
  className,
  controlsClassName,
  onReset,
  onSearchChange,
  searchAriaLabel = "Tìm kiếm",
  searchClassName,
  searchId,
  searchPlaceholder,
  searchType = "search",
  searchValue
}: {
  children?: ReactNode;
  canReset?: boolean;
  className?: string;
  controlsClassName?: string;
  onReset?: () => void;
  onSearchChange: (value: string) => void;
  searchAriaLabel?: string;
  searchClassName?: string;
  searchId?: string;
  searchPlaceholder: string;
  searchType?: HTMLInputTypeAttribute;
  searchValue: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center", className)}>
      <div className={cn("relative min-w-[190px] flex-1 xl:max-w-[240px]", searchClassName)}>
        <AppIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        />
        <Input
          aria-label={searchAriaLabel}
          className="h-9 rounded-lg bg-white pl-10 text-[13px]"
          id={searchId}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          type={searchType}
          value={searchValue}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto pb-1 xl:pb-0">
        <div className={cn("flex min-w-max flex-nowrap items-center gap-2 xl:justify-end", controlsClassName)}>
          {children}
          {onReset && canReset ? (
            <Button
              aria-label="Xóa bộ lọc"
              className="h-9 w-9 p-0"
              onClick={onReset}
              title="Xóa bộ lọc"
              type="button"
              variant="ghost"
            >
              <AppIcon name="close" className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
