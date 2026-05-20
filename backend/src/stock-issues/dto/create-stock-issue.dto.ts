import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const stockIssueItemSchema = z.object({
  materialId: z.string().trim().min(1, "Vật tư là bắt buộc"),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0"),
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm"),
});

export const createStockIssueSchema = z.object({
  warehouseId: z.string().trim().min(1, "Kho là bắt buộc"),
  projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  date: z.coerce.date(),
  reason: optionalString(500),
  notes: optionalString(2000),
  items: z
    .array(stockIssueItemSchema)
    .min(1, "Phải có ít nhất 1 vật tư")
    .max(200, "Tối đa 200 vật tư mỗi phiếu"),
});

export type CreateStockIssueDto = z.infer<typeof createStockIssueSchema>;
export type StockIssueItemDto = z.infer<typeof stockIssueItemSchema>;
