"use client";

import { ReportChartType, ReportDataset } from "@/lib/types";

export interface ReportFieldDefinition {
  key: string;
  label: string;
  kind: "dimension" | "measure" | "filter";
}

export const REPORT_CHART_OPTIONS: Array<{ value: ReportChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "area", label: "Area" },
  { value: "table", label: "Table" }
];

export const REPORT_DATASET_FIELDS: Record<
  ReportDataset,
  {
    label: string;
    dimensions: ReportFieldDefinition[];
    measures: ReportFieldDefinition[];
    filters: ReportFieldDefinition[];
  }
> = {
  customers: {
    label: "Customers",
    dimensions: [
      { key: "status", label: "Trạng thái", kind: "dimension" },
      { key: "industry", label: "Ngành", kind: "dimension" },
      { key: "assignedTo", label: "Người phụ trách", kind: "dimension" },
      { key: "isVip", label: "VIP", kind: "dimension" }
    ],
    measures: [
      { key: "projectCount", label: "Số dự án", kind: "measure" }
    ],
    filters: [
      { key: "status", label: "Trạng thái", kind: "filter" },
      { key: "industry", label: "Ngành", kind: "filter" },
      { key: "assignedTo", label: "Người phụ trách", kind: "filter" }
    ]
  },
  projects: {
    label: "Projects",
    dimensions: [
      { key: "status", label: "Trạng thái", kind: "dimension" },
      { key: "priority", label: "Ưu tiên", kind: "dimension" },
      { key: "assignedTo", label: "Owner", kind: "dimension" },
      { key: "customerName", label: "Khách hàng", kind: "dimension" },
      { key: "completedAt", label: "Ngày hoàn thành", kind: "dimension" }
    ],
    measures: [
      { key: "estimatedValue", label: "Giá trị dự kiến", kind: "measure" }
    ],
    filters: [
      { key: "status", label: "Trạng thái", kind: "filter" },
      { key: "priority", label: "Ưu tiên", kind: "filter" },
      { key: "assignedTo", label: "Owner", kind: "filter" },
      { key: "completedAt", label: "Ngày hoàn thành", kind: "filter" }
    ]
  },
  quotes: {
    label: "Quotes",
    dimensions: [
      { key: "status", label: "Trạng thái", kind: "dimension" },
      { key: "customerName", label: "Khách hàng", kind: "dimension" },
      { key: "createdBy", label: "Người tạo", kind: "dimension" }
    ],
    measures: [
      { key: "total", label: "Tổng giá trị", kind: "measure" },
      { key: "taxAmount", label: "VAT", kind: "measure" }
    ],
    filters: [
      { key: "status", label: "Trạng thái", kind: "filter" },
      { key: "customerName", label: "Khách hàng", kind: "filter" },
      { key: "projectName", label: "Dự án", kind: "filter" }
    ]
  },
  contracts: {
    label: "Contracts",
    dimensions: [
      { key: "status", label: "Trạng thái", kind: "dimension" },
      { key: "customerName", label: "Khách hàng", kind: "dimension" },
      { key: "assignedTo", label: "Owner", kind: "dimension" }
    ],
    measures: [
      { key: "value", label: "Giá trị hợp đồng", kind: "measure" }
    ],
    filters: [
      { key: "status", label: "Trạng thái", kind: "filter" },
      { key: "customerName", label: "Khách hàng", kind: "filter" },
      { key: "assignedTo", label: "Owner", kind: "filter" }
    ]
  },
  activities: {
    label: "Activities",
    dimensions: [
      { key: "type", label: "Loại hoạt động", kind: "dimension" },
      { key: "assignee", label: "Người phụ trách", kind: "dimension" },
      { key: "customerName", label: "Khách hàng", kind: "dimension" },
      { key: "isCompleted", label: "Hoàn tất", kind: "dimension" }
    ],
    measures: [
      { key: "title", label: "Số hoạt động", kind: "measure" }
    ],
    filters: [
      { key: "type", label: "Loại hoạt động", kind: "filter" },
      { key: "assignee", label: "Người phụ trách", kind: "filter" },
      { key: "customerName", label: "Khách hàng", kind: "filter" }
    ]
  },
  payments: {
    label: "Payments",
    dimensions: [
      { key: "method", label: "Phương thức", kind: "dimension" },
      { key: "customerName", label: "Khách hàng", kind: "dimension" },
      { key: "contractNo", label: "Hợp đồng", kind: "dimension" }
    ],
    measures: [
      { key: "amount", label: "Số tiền", kind: "measure" }
    ],
    filters: [
      { key: "method", label: "Phương thức", kind: "filter" },
      { key: "customerName", label: "Khách hàng", kind: "filter" },
      { key: "contractNo", label: "Hợp đồng", kind: "filter" }
    ]
  }
};

function DraggableChip({
  label,
  payload
}: {
  label: string;
  payload: Record<string, unknown>;
}) {
  return (
    <button
      draggable
      type="button"
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/ahso-report", JSON.stringify(payload));
      }}
      className="rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-medium text-text-primary transition hover:border-primary/30 hover:text-primary"
    >
      {label}
    </button>
  );
}

export function FieldSelector({
  dataset
}: {
  dataset: ReportDataset;
}) {
  const definition = REPORT_DATASET_FIELDS[dataset];

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dimensions</h3>
        <div className="flex flex-wrap gap-2">
          {definition.dimensions.map((field) => (
            <DraggableChip key={field.key} label={field.label} payload={{ zone: "dimensions", field }} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Measures</h3>
        <div className="flex flex-wrap gap-2">
          {definition.measures.map((field) => (
            <DraggableChip key={field.key} label={field.label} payload={{ zone: "measures", field }} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Filters</h3>
        <div className="flex flex-wrap gap-2">
          {definition.filters.map((field) => (
            <DraggableChip key={field.key} label={field.label} payload={{ zone: "filters", field }} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Chart</h3>
        <div className="flex flex-wrap gap-2">
          {REPORT_CHART_OPTIONS.map((option) => (
            <DraggableChip key={option.value} label={option.label} payload={{ zone: "chart", chartType: option.value }} />
          ))}
        </div>
      </section>
    </div>
  );
}
