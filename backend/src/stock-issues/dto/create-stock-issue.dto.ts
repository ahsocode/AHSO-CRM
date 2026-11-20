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
  // Optional: the unit price is always computed by the system on confirm (see INVENTORY_COSTING_SPEC §2.3).
  // A client-supplied value is ignored (warning) or rejected depending on inventory.manualIssuePriceMode.
  unitPrice: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().min(0, "Đơn giá không được âm").optional()
  ),
});

export const ISSUE_REASON_TYPES = ["PROJECT", "INTERNAL_USE", "WARRANTY", "LOSS_DAMAGE", "SAMPLE", "OTHER"] as const;

export const createStockIssueSchema = z
  .object({
  warehouseId: z.string().trim().min(1, "Kho là bắt buộc"),
  projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  date: z.coerce.date(),
  reasonType: z.enum(ISSUE_REASON_TYPES).optional(),
  reason: optionalString(500),
  notes: optionalString(2000),
  items: z
    .array(stockIssueItemSchema)
    .min(1, "Phải có ít nhất 1 vật tư")
    .max(200, "Tối đa 200 vật tư mỗi phiếu"),
  })
  .refine((value) => value.reasonType !== "PROJECT" || Boolean(value.projectId), {
    message: "Xuất cho dự án phải chọn dự án",
    path: ["projectId"],
  });

export type CreateStockIssueDto = z.infer<typeof createStockIssueSchema>;
export type StockIssueItemDto = z.infer<typeof stockIssueItemSchema>;
