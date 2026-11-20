import { z } from "zod";
import { ACCOUNTING_CLASSES } from "../material-accounting-class";
import { materialSupplierItemSchema } from "./upsert-material-supplier.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const createMaterialSchema = z.object({
  code: z.string().trim().min(1, "Mã vật tư là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên vật tư phải có ít nhất 2 ký tự").max(200),
  unit: z.string().trim().min(1, "Đơn vị là bắt buộc").max(40),
  kind: z.enum(["STOCK", "SERVICE", "PRODUCT"]).default("STOCK"),
  // Optional; resolved against `kind` in the service (SERVICE => null, PRODUCT => FINISHED_GOOD, STOCK => RAW_MATERIAL).
  accountingClass: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(ACCOUNTING_CLASSES).nullable().optional()
  ),
  salePrice: z.coerce.number().min(0, "Giá bán không được âm").default(0),
  costPrice: z.coerce.number().min(0, "Giá nhập không được âm").default(0),
  minStock: z.coerce.number().min(0).optional(),
  categoryId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  description: optionalString(2000),
  isActive: z.boolean().default(true),
  suppliers: z.array(materialSupplierItemSchema).optional(),
});

export type CreateMaterialDto = z.infer<typeof createMaterialSchema>;
