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

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().optional());

export const updateMilestoneSchema = z
  .object({
    name: z.string().trim().min(2, "Tên milestone phải có ít nhất 2 ký tự").max(160).optional(),
    description: optionalString(800),
    dueDate: optionalDate,
    status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "ACCEPTED"]).optional(),
    completedAt: optionalDate,
    paymentAmount: optionalNumber
      .refine((value) => value === undefined || value >= 0, "Ngân sách milestone không được âm")
      .refine(
        (value) => value === undefined || value <= 999_999_999_999,
        "Ngân sách milestone vượt quá giới hạn"
      ),
    notes: optionalString(1200)
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật milestone"
  });

export type UpdateMilestoneDto = z.infer<typeof updateMilestoneSchema>;
