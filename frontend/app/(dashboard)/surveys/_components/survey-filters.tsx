"use client";

import { Input } from "@/components/ui/input";
import type { SurveyListFilter } from "@/lib/types";

interface SurveyFiltersProps {
  filters: SurveyListFilter;
  onFiltersChange: (filters: SurveyListFilter) => void;
}

export function SurveyFilters({ filters, onFiltersChange }: SurveyFiltersProps) {
  const update = (patch: Partial<SurveyListFilter>) =>
    onFiltersChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="flex flex-wrap gap-3">
      <Input
        className="w-full sm:w-64"
        placeholder="Tìm theo tiêu đề, địa điểm, tóm tắt..."
        value={filters.search ?? ""}
        onChange={(e) => update({ search: e.target.value || undefined })}
      />
      <Input
        className="w-40"
        type="date"
        placeholder="Từ ngày"
        value={filters.dateFrom ?? ""}
        onChange={(e) => update({ dateFrom: e.target.value || undefined })}
      />
      <Input
        className="w-40"
        type="date"
        placeholder="Đến ngày"
        value={filters.dateTo ?? ""}
        onChange={(e) => update({ dateTo: e.target.value || undefined })}
      />
    </div>
  );
}
