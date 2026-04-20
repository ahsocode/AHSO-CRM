"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area } from "recharts";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateReportTemplate,
  useDeleteReportTemplate,
  useReportTemplates,
  useRunCustomReportQuery,
  useUpdateReportTemplate
} from "@/hooks/use-reports";
import { ReportBuilderConfig, ReportBuilderFilter, ReportBuilderMeasure, ReportChartType, ReportDataset, ReportTemplate } from "@/lib/types";
import { ChartConfig } from "./chart-config";
import { FieldSelector, REPORT_DATASET_FIELDS } from "./field-selector";

const CHART_COLORS = ["#1a5276", "#2e86ab", "#5dade2", "#f39c12", "#16a085", "#c0392b"];

const defaultConfig: ReportBuilderConfig = {
  dataset: "projects",
  dimensions: ["status"],
  measures: [
    {
      field: "estimatedValue",
      label: "Giá trị dự kiến",
      aggregator: "sum"
    }
  ],
  filters: [],
  chartType: "bar"
};

function DropZone({
  title,
  description,
  onDrop,
  children
}: {
  title: string;
  description: string;
  onDrop: (payload: Record<string, unknown>) => void;
  children: React.ReactNode;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const rawValue = event.dataTransfer.getData("application/ahso-report");
        if (!rawValue) {
          return;
        }

        try {
          onDrop(JSON.parse(rawValue) as Record<string, unknown>);
        } catch {
          // Ignore malformed drop payloads.
        }
      }}
      className={cn(
        "rounded-3xl border border-dashed p-4 transition",
        isDragOver ? "border-primary/40 bg-primary/5" : "border-border/70 bg-bg-hover/30"
      )}
    >
      <div className="mb-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary">{description}</p>
      </div>
      {children}
    </div>
  );
}

function removeAtIndex<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function ReportChart({
  chartType,
  data
}: {
  chartType: ReportChartType;
  data: Record<string, unknown>[];
}) {
  const firstRow = data[0] ?? {};
  const keys = Object.keys(firstRow);
  const categoryKey = keys[0];
  const measureKeys = keys.slice(1);

  if (chartType === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {keys.map((key) => (
                <th key={key} className="px-3">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="bg-white/90">
                {keys.map((key, keyIndex) => (
                  <td key={key} className={cn("px-3 py-3 text-sm text-text-primary", keyIndex === 0 ? "rounded-l-2xl" : "", keyIndex === keys.length - 1 ? "rounded-r-2xl" : "")}>
                    {String(row[key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!categoryKey || measureKeys.length === 0) {
    return (
      <EmptyState
        title="Chưa đủ dữ liệu để vẽ chart"
        description="Hãy thêm dimension và measure, sau đó chạy lại truy vấn."
      />
    );
  }

  if (chartType === "pie") {
    const measureKey = measureKeys[0];
    return (
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey={measureKey} nameKey={categoryKey} innerRadius={70} outerRadius={120}>
              {data.map((entry, index) => (
                <Cell key={`${String(entry[categoryKey])}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const ChartComponent = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : BarChart;

  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={categoryKey} stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip />
          <Legend />
          {measureKeys.map((key, index) =>
            chartType === "line" ? (
              <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} />
            ) : chartType === "area" ? (
              <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.18} />
            ) : (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[index % CHART_COLORS.length]} radius={[10, 10, 0, 0]} />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportBuilder() {
  const runQueryMutation = useRunCustomReportQuery();
  const templatesQuery = useReportTemplates();
  const createTemplateMutation = useCreateReportTemplate();
  const deleteTemplateMutation = useDeleteReportTemplate();
  const { error: showError, success } = useToast();

  const [config, setConfig] = useState<ReportBuilderConfig>(defaultConfig);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<ReportTemplate | null>(null);
  const updateTemplateMutation = useUpdateReportTemplate(activeTemplate?.id ?? "");

  const datasetDefinition = REPORT_DATASET_FIELDS[config.dataset];
  const result = runQueryMutation.data;
  const rows = result?.rows ?? [];
  const chartData = result?.chartData ?? [];
  const canExport = chartData.length > 0 || rows.length > 0;

  const handleDrop = (zone: "dimensions" | "measures" | "filters" | "chart", payload: Record<string, unknown>) => {
    if (zone === "chart") {
      if (typeof payload.chartType === "string") {
        setConfig((current) => ({
          ...current,
          chartType: payload.chartType as ReportChartType
        }));
      }
      return;
    }

    const field = payload.field as { key?: string; label?: string } | undefined;
    if (!field?.key || !field.label) {
      return;
    }
    const fieldKey = field.key;
    const fieldLabel = field.label;

    if (zone === "dimensions") {
      setConfig((current) => ({
        ...current,
        dimensions: current.dimensions.includes(fieldKey)
          ? current.dimensions
          : [...current.dimensions, fieldKey].slice(0, 2)
      }));
      return;
    }

    if (zone === "measures") {
      setConfig((current) => ({
        ...current,
        measures: current.measures.some((measure) => measure.field === fieldKey)
          ? current.measures
          : [
              ...current.measures,
              {
                field: fieldKey,
                label: fieldLabel,
                aggregator: fieldKey === "title" ? "count" : "sum"
              }
            ]
      }));
      return;
    }

      setConfig((current) => ({
        ...current,
      filters: current.filters.some((filter) => filter.field === fieldKey)
        ? current.filters
        : [...current.filters, { field: fieldKey, operator: "contains", value: "" }]
    }));
  };

  const handleExportCsv = () => {
    const exportRows = chartData.length ? chartData : rows;
    const headers = Object.keys(exportRows[0] ?? {});
    const csv = buildCsv(headers, exportRows);
    downloadCsv(`report-${config.dataset}.csv`, csv);
  };

  const handleExportExcel = async () => {
    const exportRows = chartData.length ? chartData : rows;
    if (!exportRows.length) {
      return;
    }

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Report");
    const headers = Object.keys(exportRows[0]);

    worksheet.addRow(headers);
    exportRows.forEach((row) => {
      worksheet.addRow(headers.map((header) => row[header]));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${config.dataset}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      showError("Cần nhập tên template trước khi lưu.");
      return;
    }

    try {
      if (activeTemplate) {
        const updated = await updateTemplateMutation.mutateAsync({
          name: templateName,
          description: templateDescription || undefined,
          resource: config.dataset,
          isShared,
          config
        });
        setActiveTemplate(updated);
        success("Đã cập nhật template báo cáo.");
      } else {
        const created = await createTemplateMutation.mutateAsync({
          name: templateName,
          description: templateDescription || undefined,
          resource: config.dataset,
          isShared,
          config
        });
        setActiveTemplate(created);
        success("Đã lưu template báo cáo.");
      }
    } catch (error) {
      showError(getApiErrorMessage(error, "Không thể lưu template báo cáo."));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Custom Report Builder"
        description="Kéo field vào Dimensions, Measures, Filters hoặc Chart để lắp một báo cáo tùy biến theo đúng pipeline của đội."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => void runQueryMutation.mutateAsync(config)}>
              Chạy truy vấn
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveTemplate}>
              {activeTemplate ? "Cập nhật template" : "Lưu template"}
            </Button>
            {activeTemplate ? (
              <Button
                type="button"
                variant="ghost"
                disabled={deleteTemplateMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Xóa template "${activeTemplate.name}"?`)) {
                    return;
                  }

                  deleteTemplateMutation.mutate(activeTemplate.id, {
                    onSuccess: () => {
                      setActiveTemplate(null);
                      setTemplateName("");
                      setTemplateDescription("");
                      setIsShared(false);
                      success("Đã xóa template báo cáo.");
                    }
                  });
                }}
              >
                Xóa template
              </Button>
            ) : null}
            <Link href="/reports" className={cn(buttonVariants({ variant: "outline" }))}>
              Về Reports
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dataset Config</p>
              <CardTitle>Cấu hình template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChartConfig
                config={config}
                templateName={templateName}
                templateDescription={templateDescription}
                isShared={isShared}
                onDatasetChange={(dataset) => {
                  setConfig({
                    dataset,
                    dimensions: REPORT_DATASET_FIELDS[dataset].dimensions.slice(0, 1).map((field) => field.key),
                    measures: [
                      {
                        field: REPORT_DATASET_FIELDS[dataset].measures[0]?.key ?? "count",
                        label: REPORT_DATASET_FIELDS[dataset].measures[0]?.label ?? "Count",
                        aggregator: REPORT_DATASET_FIELDS[dataset].measures[0]?.key === "title" ? "count" : "sum"
                      }
                    ],
                    filters: [],
                    chartType: "bar"
                  });
                  setActiveTemplate(null);
                }}
                onChartTypeChange={(chartType) => setConfig((current) => ({ ...current, chartType }))}
                onTemplateNameChange={setTemplateName}
                onTemplateDescriptionChange={setTemplateDescription}
                onSharedChange={setIsShared}
              />
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Field Library</p>
              <CardTitle>Kéo field vào các zone</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldSelector dataset={config.dataset} />
            </CardContent>
          </Card>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Templates</p>
              <CardTitle>Template đã lưu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templatesQuery.isLoading ? (
                <LoadingSkeleton className="h-40 w-full" />
              ) : templatesQuery.data?.length ? (
                templatesQuery.data.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      "w-full rounded-2xl border px-4 py-4 text-left transition",
                      activeTemplate?.id === template.id ? "border-primary/30 bg-primary/5" : "border-border/60 bg-white/80"
                    )}
                    onClick={() => {
                      setActiveTemplate(template);
                      setConfig(template.config);
                      setTemplateName(template.name);
                      setTemplateDescription(template.description ?? "");
                      setIsShared(template.isShared);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-primary">{template.name}</p>
                        <p className="mt-1 text-sm text-text-secondary">{template.description ?? "Không có mô tả"}</p>
                      </div>
                      {template.isShared ? (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                          Shared
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState
                  title="Chưa có template nào"
                  description="Sau khi thiết kế một báo cáo phù hợp, hãy lưu lại để đội dùng lại nhanh hơn."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DropZone
              title="Dimensions"
              description="Tối đa 2 field để nhóm dữ liệu."
              onDrop={(payload) => handleDrop("dimensions", payload)}
            >
              <div className="flex min-h-[120px] flex-wrap gap-2">
                {config.dimensions.length ? (
                  config.dimensions.map((dimension, index) => (
                    <button
                      key={dimension}
                      type="button"
                      className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                      onClick={() => setConfig((current) => ({ ...current, dimensions: removeAtIndex(current.dimensions, index) }))}
                    >
                      {datasetDefinition.dimensions.find((field) => field.key === dimension)?.label ?? dimension} ✕
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">Kéo dimension vào đây.</p>
                )}
              </div>
            </DropZone>

            <DropZone
              title="Measures"
              description="Ít nhất 1 measure để tính tổng hoặc count."
              onDrop={(payload) => handleDrop("measures", payload)}
            >
              <div className="space-y-3">
                {config.measures.length ? (
                  config.measures.map((measure, index) => (
                    <div key={`${measure.field}-${index}`} className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-text-primary">{measure.label}</p>
                        <button
                          type="button"
                          className="text-sm text-text-secondary hover:text-danger"
                          onClick={() => setConfig((current) => ({ ...current, measures: removeAtIndex(current.measures, index) }))}
                        >
                          Xóa
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Input
                          value={measure.label}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              measures: current.measures.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label: event.target.value } : item
                              )
                            }))
                          }
                        />
                        <Select
                          value={measure.aggregator}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              measures: current.measures.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, aggregator: event.target.value as ReportBuilderMeasure["aggregator"] } : item
                              )
                            }))
                          }
                        >
                          <option value="sum">sum</option>
                          <option value="count">count</option>
                        </Select>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">Kéo measure vào đây.</p>
                )}
              </div>
            </DropZone>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <DropZone
              title="Filters"
              description="AND-only cho phiên bản v1."
              onDrop={(payload) => handleDrop("filters", payload)}
            >
              <div className="space-y-3">
                {config.filters.length ? (
                  config.filters.map((filter, index) => (
                    <div key={`${filter.field}-${index}`} className="rounded-2xl border border-border/60 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-text-primary">
                          {datasetDefinition.filters.find((item) => item.key === filter.field)?.label ?? filter.field}
                        </p>
                        <button
                          type="button"
                          className="text-sm text-text-secondary hover:text-danger"
                          onClick={() => setConfig((current) => ({ ...current, filters: removeAtIndex(current.filters, index) }))}
                        >
                          Xóa
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
                        <Select
                          value={filter.operator}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              filters: current.filters.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, operator: event.target.value as ReportBuilderFilter["operator"] } : item
                              )
                            }))
                          }
                        >
                          <option value="contains">contains</option>
                          <option value="eq">eq</option>
                          <option value="neq">neq</option>
                          <option value="gte">gte</option>
                          <option value="lte">lte</option>
                        </Select>
                        <Input
                          value={Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value ?? "")}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              filters: current.filters.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      value:
                                        item.operator === "in"
                                          ? event.target.value.split(",").map((value) => value.trim()).filter(Boolean)
                                          : event.target.value
                                    }
                                  : item
                              )
                            }))
                          }
                          placeholder="Giá trị lọc"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">Kéo filter vào đây.</p>
                )}
              </div>
            </DropZone>

            <DropZone
              title="Chart"
              description="Kéo chart type vào đây hoặc chọn ở phần cấu hình."
              onDrop={(payload) => handleDrop("chart", payload)}
            >
              <div className="flex min-h-[120px] items-center">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  {config.chartType.toUpperCase()}
                </span>
              </div>
            </DropZone>
          </div>

          <Card className="border border-white/70">
            <CardHeader className="mb-0 gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Result Preview</p>
                  <CardTitle>Kết quả truy vấn</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" disabled={!canExport} onClick={handleExportCsv}>
                    Export CSV
                  </Button>
                  <Button type="button" variant="outline" disabled={!canExport} onClick={() => void handleExportExcel()}>
                    Export Excel
                  </Button>
                  <Button type="button" variant="ghost" disabled={!canExport} onClick={() => window.print()}>
                    In / Lưu PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {runQueryMutation.isPending ? (
                <LoadingSkeleton className="h-[420px] w-full" />
              ) : runQueryMutation.isError ? (
                <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
                  {getApiErrorMessage(runQueryMutation.error, "Không thể chạy custom report query.")}
                </div>
              ) : chartData.length ? (
                <>
                  <div className="rounded-2xl border border-border/60 bg-bg-hover/30 px-4 py-3 text-sm text-text-secondary">
                    Dataset <span className="font-semibold text-text-primary">{result?.summary.dataset}</span> · {result?.summary.rowCount} dòng sau lọc
                  </div>
                  <ReportChart chartType={config.chartType} data={chartData} />
                </>
              ) : (
                <EmptyState
                  title="Chưa có kết quả"
                  description="Kéo fields vào zones, chọn chart phù hợp và bấm Chạy truy vấn để xem preview."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
