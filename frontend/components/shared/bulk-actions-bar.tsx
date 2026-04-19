"use client";

import { Button } from "@/components/ui/button";

export function BulkActionsBar({
  count,
  children,
  onClear
}: {
  count: number;
  children: React.ReactNode;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-primary/20 bg-primary/5 px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Bulk actions</p>
        <p className="mt-1 text-sm text-text-primary">{count} bản ghi đang được chọn.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button type="button" variant="ghost" onClick={onClear}>
          Bỏ chọn
        </Button>
      </div>
    </div>
  );
}
