import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const stockTransferItemSchema = z.object({
  materialId: z.string().trim().min(1, "Vật tư là bắt buộc"),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0"),
});

export const createStockTransferSchema = z.object({
  fromWarehouseId: z.string().trim().min(1, "Kho xuất là bắt buộc"),
  toWarehouseId: z.string().trim().min(1, "Kho nhận là bắt buộc"),
  date: z.coerce.date(),
  notes: optionalString(2000),
  items: z
    .array(stockTransferItemSchema)
    .min(1, "Phải có ít nhất 1 vật tư")
    .max(200, "Tối đa 200 vật tư mỗi phiếu"),
});

export type CreateStockTransferDto = z.infer<typeof createStockTransferSchema>;
export type StockTransferItemDto = z.infer<typeof stockTransferItemSchema>;
