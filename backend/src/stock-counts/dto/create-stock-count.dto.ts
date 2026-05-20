import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const stockCountItemSchema = z.object({
  materialId: z.string().trim().min(1, "Vật tư là bắt buộc"),
  actualQuantity: z.coerce.number().min(0, "Số lượng thực tế không được âm"),
});

export const createStockCountSchema = z.object({
  warehouseId: z.string().trim().min(1, "Kho là bắt buộc"),
  date: z.coerce.date(),
  notes: optionalString(2000),
  items: z
    .array(stockCountItemSchema)
    .min(1, "Phải có ít nhất 1 vật tư")
    .max(200, "Tối đa 200 vật tư mỗi phiếu"),
});

export type CreateStockCountDto = z.infer<typeof createStockCountSchema>;
export type StockCountItemDto = z.infer<typeof stockCountItemSchema>;
