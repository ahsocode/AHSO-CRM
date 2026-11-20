import { z } from "zod";
import { ACCOUNTING_CLASSES } from "../material-accounting-class";

const rowSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu materialId"),
  accountingClass: z.enum(ACCOUNTING_CLASSES).nullable(),
});

/** Accepts either a bare array or { items: [...] }. */
export const bulkMaterialClassSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { items: value } : value),
  z.object({
    items: z.array(rowSchema).min(1, "Chưa có dòng nào").max(500, "Tối đa 500 dòng mỗi lần"),
  })
);

export type BulkMaterialClassDto = z.infer<typeof bulkMaterialClassSchema>;
