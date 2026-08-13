"use client";

import { useMemo } from "react";
import { CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { APP_TIME_ZONE } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DashboardDateRange {
  dateFrom: string;
  dateTo: string;
}

type DashboardRangePreset = "current-year" | "last-30-days" | "last-90-days" | "last-12-months" | "custom";

const RANGE_PRESETS: Array<{ label: string; value: DashboardRangePreset }> = [
  { label: "Năm hiện hành", value: "current-year" },
  { label: "30 ngày qua", value: "last-30-days" },
  { label: "90 ngày qua", value: "last-90-days" },
  { label: "12 tháng qua", value: "last-12-months" },
  { label: "Tùy chỉnh", value: "custom" }
];
const DAY_MS = 24 * 60 * 60 * 1000;

function getBusinessDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day"))
  };
}

function toDateInputValue(date: Date) {
  const { year, month, day } = getBusinessDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function shiftMonths(date: Date, months: number) {
  const { year, month, day } = getBusinessDateParts(date);
  return new Date(Date.UTC(year, month - 1 + months, day));
}

export function getDefaultDashboardDateRange(referenceDate = new Date()): DashboardDateRange {
  const { year } = getBusinessDateParts(referenceDate);

  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`
  };
}

function getPresetDateRange(preset: DashboardRangePreset, referenceDate = new Date()): DashboardDateRange {
  const today = toDateInputValue(referenceDate);

  switch (preset) {
    case "last-30-days":
      return {
        dateFrom: toDateInputValue(shiftDays(referenceDate, -29)),
        dateTo: today
      };
    case "last-90-days":
      return {
        dateFrom: toDateInputValue(shiftDays(referenceDate, -89)),
        dateTo: today
      };
    case "last-12-months":
      return {
        dateFrom: toDateInputValue(shiftDays(shiftMonths(referenceDate, -12), 1)),
        dateTo: today
      };
    case "current-year":
    case "custom":
    default:
      return getDefaultDashboardDateRange(referenceDate);
  }
}

function resolveSelectedPreset(range: DashboardDateRange): DashboardRangePreset {
  const matchedPreset = RANGE_PRESETS
    .filter((preset) => preset.value !== "custom")
    .find((preset) => {
      const presetRange = getPresetDateRange(preset.value);
      return presetRange.dateFrom === range.dateFrom && presetRange.dateTo === range.dateTo;
    });

  return matchedPreset?.value ?? "custom";
}

export function DashboardDateRangeFilter({
  range,
  onRangeChange,
  className
}: {
  range: DashboardDateRange;
  onRangeChange: (range: DashboardDateRange) => void;
  className?: string;
}) {
  const selectedPreset = useMemo(() => resolveSelectedPreset(range), [range]);
  const defaultRange = useMemo(() => getDefaultDashboardDateRange(), []);
  const canReset = range.dateFrom !== defaultRange.dateFrom || range.dateTo !== defaultRange.dateTo;

  const handlePresetChange = (value: string) => {
    const preset = value as DashboardRangePreset;
    if (preset === "custom") {
      return;
    }

    onRangeChange(getPresetDateRange(preset));
  };

  const handleDateFromChange = (dateFrom: string) => {
    onRangeChange({
      dateFrom,
      dateTo: range.dateTo && dateFrom > range.dateTo ? dateFrom : range.dateTo
    });
  };

  const handleDateToChange = (dateTo: string) => {
    onRangeChange({
      dateFrom: range.dateFrom && dateTo < range.dateFrom ? dateTo : range.dateFrom,
      dateTo
    });
  };

  return (
    <div
      className={cn(
        "grid w-full gap-2 rounded-md border border-white/70 bg-white/85 p-3 shadow-sm md:w-auto md:grid-cols-[170px_148px_148px_auto] md:items-end",
        className
      )}
    >
      <label className="space-y-1.5">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
          <CalendarDays className="h-3.5 w-3.5" />
          Khoảng thời gian
        </span>
        <Select value={selectedPreset} onChange={(event) => handlePresetChange(event.target.value)} className="h-10">
          {RANGE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Từ ngày</span>
        <Input
          type="date"
          value={range.dateFrom}
          onChange={(event) => handleDateFromChange(event.target.value)}
          className="h-10 px-3"
        />
      </label>

      <label className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">Đến ngày</span>
        <Input
          type="date"
          value={range.dateTo}
          onChange={(event) => handleDateToChange(event.target.value)}
          className="h-10 px-3"
        />
      </label>

      <Button
        type="button"
        variant="outline"
        size="md"
        className="h-10 px-3"
        disabled={!canReset}
        title="Đặt lại năm hiện hành"
        aria-label="Đặt lại năm hiện hành"
        onClick={() => onRangeChange(defaultRange)}
      >
        <RotateCcw className="h-4 w-4" />
        <span className="hidden xl:inline">Đặt lại</span>
      </Button>
    </div>
  );
}
