import { z } from "zod";

export const reportDatasetSchema = z.enum([
  "customers",
  "projects",
  "quotes",
  "contracts",
  "activities",
  "payments"
]);

export const reportChartTypeSchema = z.enum(["bar", "line", "pie", "area", "table"]);
export const reportFilterOperatorSchema = z.enum(["eq", "neq", "contains", "gte", "lte", "in"]);
export const reportMeasureAggregatorSchema = z.enum(["count", "sum"]);

export const customReportFilterSchema = z.object({
  field: z.string().trim().min(1),
  operator: reportFilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
});

export const customReportMeasureSchema = z.object({
  field: z.string().trim().min(1),
  label: z.string().trim().min(1),
  aggregator: reportMeasureAggregatorSchema.default("sum")
});

export const customReportQuerySchema = z.object({
  dataset: reportDatasetSchema,
  dimensions: z.array(z.string().trim().min(1)).max(2).default([]),
  measures: z.array(customReportMeasureSchema).min(1),
  filters: z.array(customReportFilterSchema).default([]),
  chartType: reportChartTypeSchema.default("table")
});

export const reportTemplateSchema = z.object({
  name: z.string().trim().min(1, "Tên template là bắt buộc"),
  description: z.string().trim().max(300).optional(),
  resource: reportDatasetSchema,
  isShared: z.boolean().optional().default(false),
  config: customReportQuerySchema
});

export const updateReportTemplateSchema = reportTemplateSchema.partial();

export type CustomReportQueryDto = z.infer<typeof customReportQuerySchema>;
export type ReportTemplateDto = z.infer<typeof reportTemplateSchema>;
export type UpdateReportTemplateDto = z.infer<typeof updateReportTemplateSchema>;
