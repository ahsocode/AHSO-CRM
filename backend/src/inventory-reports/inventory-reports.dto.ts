import { z } from "zod";
import {
  coerceBool,
  optionalDate,
  optionalString,
  reportPaginationShape,
  requiredDate
} from "./report-contract";

const accountingClassFilter = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.enum(["RAW_MATERIAL", "TOOL", "MERCHANDISE", "FINISHED_GOOD", "CONSUMABLE_COMMON", "UNCLASSIFIED"]).optional()
);

export const stockLedgerQuerySchema = z
  .object({
    materialId: optionalString,
    warehouseId: optionalString,
    fromDate: requiredDate,
    toDate: requiredDate,
    ...reportPaginationShape
  })
  .refine((q) => q.fromDate.getTime() <= q.toDate.getTime(), { message: "fromDate phải ≤ toDate", path: ["fromDate"] });
export type StockLedgerQuery = z.infer<typeof stockLedgerQuerySchema>;

export const inventoryValuationQuerySchema = z.object({
  asOfDate: optionalDate,
  warehouseId: optionalString,
  materialId: optionalString,
  accountingClass: accountingClassFilter,
  groupBy: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(["none", "accountingClass", "warehouse"]).default("none")
  ),
  ...reportPaginationShape
});
export type InventoryValuationQuery = z.infer<typeof inventoryValuationQuerySchema>;

export const projectCostQuerySchema = z
  .object({
    projectId: optionalString,
    fromDate: optionalDate,
    toDate: optionalDate,
    includeLines: coerceBool,
    ...reportPaginationShape
  })
  .refine((q) => !q.fromDate || !q.toDate || q.fromDate.getTime() <= q.toDate.getTime(), {
    message: "fromDate phải ≤ toDate",
    path: ["fromDate"]
  });
export type ProjectCostQuery = z.infer<typeof projectCostQuerySchema>;

export const unallocatedReceiptsQuerySchema = z.object({
  fromDate: optionalDate,
  toDate: optionalDate,
  warehouseId: optionalString,
  supplierId: optionalString,
  materialId: optionalString,
  includeCommon: coerceBool,
  ...reportPaginationShape
});
export type UnallocatedReceiptsQuery = z.infer<typeof unallocatedReceiptsQuerySchema>;

export const receiptsWithoutInvoiceQuerySchema = z.object({
  fromDate: optionalDate,
  toDate: optionalDate,
  warehouseId: optionalString,
  supplierId: optionalString,
  mode: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(["NUMBER", "ANY_FIELD"]).default("NUMBER")
  ),
  ...reportPaginationShape
});
export type ReceiptsWithoutInvoiceQuery = z.infer<typeof receiptsWithoutInvoiceQuerySchema>;

export const invoiceDateWarningsQuerySchema = z.object({
  fromDate: optionalDate,
  toDate: optionalDate,
  projectId: optionalString,
  materialId: optionalString,
  warehouseId: optionalString,
  includeCancelled: coerceBool,
  ...reportPaginationShape
});
export type InvoiceDateWarningsQuery = z.infer<typeof invoiceDateWarningsQuerySchema>;
