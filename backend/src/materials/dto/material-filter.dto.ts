import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const coerceBoolean = z.preprocess((val) => {
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}, z.boolean().optional());

export const materialFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  supplierId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  isActive: coerceBoolean,
  lowStockOnly: coerceBoolean,
});

export type MaterialFilterDto = z.infer<typeof materialFilterSchema>;
