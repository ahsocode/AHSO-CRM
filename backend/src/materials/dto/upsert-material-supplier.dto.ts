import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const materialSupplierItemSchema = z.object({
  supplierId: z.string().trim().min(1, "Nhà cung cấp là bắt buộc"),
  supplierCode: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
  costPrice: z.coerce.number().min(0, "Giá nhập không được âm").default(0),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  isPreferred: z.boolean().default(false),
});

export const upsertMaterialSuppliersSchema = z.array(materialSupplierItemSchema);

export type UpsertMaterialSuppliersDto = z.infer<typeof upsertMaterialSuppliersSchema>;
export type MaterialSupplierItemDto = z.infer<typeof materialSupplierItemSchema>;
