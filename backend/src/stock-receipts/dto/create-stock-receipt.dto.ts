import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const stockReceiptItemSchema = z.object({
  materialId: z.string().trim().min(1, "Vật tư là bắt buộc"),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0"),
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm"),
});

export const createStockReceiptSchema = z.object({
  warehouseId: z.string().trim().min(1, "Kho là bắt buộc"),
  supplierId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  date: z.coerce.date(),
  notes: optionalString(2000),
  items: z
    .array(stockReceiptItemSchema)
    .min(1, "Phải có ít nhất 1 vật tư")
    .max(200, "Tối đa 200 vật tư mỗi phiếu"),
});

export type CreateStockReceiptDto = z.infer<typeof createStockReceiptSchema>;
export type StockReceiptItemDto = z.infer<typeof stockReceiptItemSchema>;
