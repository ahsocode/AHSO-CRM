import { z } from "zod";

export const SUPPLIER_TYPES = ["GOODS", "SERVICE", "EXPENSE", "OTHER"] as const;

const rowSchema = z.object({
  supplierId: z.string().trim().min(1, "Thiếu supplierId"),
  supplierType: z.enum(SUPPLIER_TYPES),
});

/** Accepts either a bare array or { items: [...] }. */
export const bulkSupplierTypeSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { items: value } : value),
  z.object({
    items: z.array(rowSchema).min(1, "Chưa có dòng nào").max(500, "Tối đa 500 dòng mỗi lần"),
  })
);

export type BulkSupplierTypeDto = z.infer<typeof bulkSupplierTypeSchema>;
