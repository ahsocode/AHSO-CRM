"use client";

import { CompactFilterToolbar } from "@/components/shared/compact-filter-toolbar";
import { Input } from "@/components/ui/input";
import type { SurveyListFilter } from "@/lib/types";

interface SurveyFiltersProps {
  filters: SurveyListFilter;
  onFiltersChange: (filters: SurveyListFilter) => void;
}

export function SurveyFilters({ filters, onFiltersChange }: SurveyFiltersProps) {
  const update = (patch: Partial<SurveyListFilter>) =>
    onFiltersChange({ ...filters, ...patch, page: 1 });
  const canReset = Boolean(filters.search || filters.dateFrom || filters.dateTo);

  return (
    <CompactFilterToolbar
      canReset={canReset}
      onReset={() => onFiltersChange({ ...filters, search: undefined, dateFrom: undefined, dateTo: undefined, page: 1 })}
      onSearchChange={(value) => update({ search: value || undefined })}
      searchAriaLabel="Tìm kiếm khảo sát"
      searchPlaceholder="Tiêu đề, địa điểm, tóm tắt..."
      searchValue={filters.search ?? ""}
    >
      <Input
        aria-label="Từ ngày"
        className="h-9 w-[132px] rounded-lg bg-white text-[12.5px]"
        type="date"
        value={filters.dateFrom ?? ""}
        onChange={(e) => update({ dateFrom: e.target.value || undefined })}
      />
      <Input
        aria-label="Đến ngày"
        className="h-9 w-[132px] rounded-lg bg-white text-[12.5px]"
        type="date"
        value={filters.dateTo ?? ""}
        onChange={(e) => update({ dateTo: e.target.value || undefined })}
      />
    </CompactFilterToolbar>
  );
}
