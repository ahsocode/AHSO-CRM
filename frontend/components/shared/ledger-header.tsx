"use client";

import type { ReactNode } from "react";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LedgerPagination({
  className,
  currentPage,
  onPageChange,
  totalPages
}: {
  className?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <Button
        aria-label="Trang trước"
        className="h-9 w-9 p-0"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        size="sm"
        title="Trang trước"
        type="button"
        variant="outline"
      >
        <AppIcon name="chevron-left" className="h-4 w-4" />
      </Button>
      <span className="min-w-[2.75rem] text-center text-sm font-medium text-text-secondary">
        {currentPage} / {totalPages}
      </span>
      <Button
        aria-label="Trang sau"
        className="h-9 w-9 p-0"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        size="sm"
        title="Trang sau"
        type="button"
        variant="outline"
      >
        <AppIcon name="chevron-right" className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function LedgerHeader({
  className,
  currentPage,
  eyebrow,
  metaText,
  onPageChange,
  title,
  titleClassName,
  toolbar,
  totalPages
}: {
  className?: string;
  currentPage?: number;
  eyebrow?: string;
  metaText?: ReactNode;
  onPageChange?: (page: number) => void;
  title: string;
  titleClassName?: string;
  toolbar?: ReactNode;
  totalPages?: number;
}) {
  const pages = Math.max(totalPages ?? 1, 1);
  const page = Math.min(Math.max(currentPage ?? 1, 1), pages);

  return (
    <CardHeader className={cn("mb-0 gap-3 border-b border-border-light px-5 py-4", className)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{eyebrow}</p>
          ) : null}
          <CardTitle className={titleClassName}>{title}</CardTitle>
          {metaText ? <p className="mt-1 text-sm text-text-secondary">{metaText}</p> : null}
        </div>
        {toolbar ? <div className="min-w-0 flex-1 xl:px-1">{toolbar}</div> : null}
        {onPageChange ? <LedgerPagination currentPage={page} onPageChange={onPageChange} totalPages={pages} /> : null}
      </div>
    </CardHeader>
  );
}
