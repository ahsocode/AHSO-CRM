import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const eligibleStockLotsSchema = z.object({
  salesInvoiceDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  limit: z.coerce.number().int().min(1).max(500).default(200).optional()
});

export const projectMaterialAllocationItemSchema = z.object({
  stockLotId: z.string().trim().min(1, "Chọn lô nhập"),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0")
});

export const upsertProjectMaterialAllocationSchema = z.object({
  salesInvoiceDate: z.coerce.date(),
  notes: optionalString(2000),
  items: z
    .array(projectMaterialAllocationItemSchema)
    .min(1, "Phải có ít nhất một lô vật tư")
    .max(200, "Tối đa 200 lô vật tư")
});

export type EligibleStockLotsDto = z.infer<typeof eligibleStockLotsSchema>;
export type UpsertProjectMaterialAllocationDto = z.infer<typeof upsertProjectMaterialAllocationSchema>;
