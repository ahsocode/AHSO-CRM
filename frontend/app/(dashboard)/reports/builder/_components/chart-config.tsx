"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ReportBuilderConfig, ReportChartType, ReportDataset } from "@/lib/types";
import { REPORT_CHART_OPTIONS, REPORT_DATASET_FIELDS } from "./field-selector";

export function ChartConfig({
  config,
  templateName,
  templateDescription,
  isShared,
  onDatasetChange,
  onChartTypeChange,
  onTemplateNameChange,
  onTemplateDescriptionChange,
  onSharedChange
}: {
  config: ReportBuilderConfig;
  templateName: string;
  templateDescription: string;
  isShared: boolean;
  onDatasetChange: (dataset: ReportDataset) => void;
  onChartTypeChange: (chartType: ReportChartType) => void;
  onTemplateNameChange: (value: string) => void;
  onTemplateDescriptionChange: (value: string) => void;
  onSharedChange: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2">
        <span className="text-sm font-semibold text-text-primary">Dataset</span>
        <Select value={config.dataset} onChange={(event) => onDatasetChange(event.target.value as ReportDataset)}>
          {Object.entries(REPORT_DATASET_FIELDS).map(([value, definition]) => (
            <option key={value} value={value}>
              {definition.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-text-primary">Chart type</span>
        <Select value={config.chartType} onChange={(event) => onChartTypeChange(event.target.value as ReportChartType)}>
          {REPORT_CHART_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-text-primary">Tên template</span>
        <Input value={templateName} onChange={(event) => onTemplateNameChange(event.target.value)} placeholder="Ví dụ: Pipeline by owner" />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-text-primary">Mô tả</span>
        <Input
          value={templateDescription}
          onChange={(event) => onTemplateDescriptionChange(event.target.value)}
          placeholder="Ghi chú ngắn về báo cáo"
        />
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/80 px-4 py-3 md:col-span-2">
        <input type="checkbox" checked={isShared} onChange={(event) => onSharedChange(event.target.checked)} />
        <span className="text-sm text-text-secondary">Chia sẻ template này cho team</span>
      </label>
    </div>
  );
}
