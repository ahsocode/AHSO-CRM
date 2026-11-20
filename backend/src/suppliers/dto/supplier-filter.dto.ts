import { z } from "zod";
import { SUPPLIER_TYPES } from "./bulk-supplier-type.dto";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const supplierFilterSchema = paginationSchema.extend({
  supplierType: z.preprocess(emptyToUndefined, z.enum(SUPPLIER_TYPES).optional()),
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  isActive: z.preprocess(
    (val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    },
    z.boolean().optional()
  ),
});

export type SupplierFilterDto = z.infer<typeof supplierFilterSchema>;
