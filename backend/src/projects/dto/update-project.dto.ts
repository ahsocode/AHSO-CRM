import { z } from "zod";
import { customFieldValuesSchema } from "../../custom-fields/dto/custom-field.dto";

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

export const updateProjectSchema = z
  .object({
    customerId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(2, "Tên dự án phải có ít nhất 2 ký tự").max(180).optional(),
    description: optionalString(1000),
    status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
    estimatedValue: z.coerce.number().min(0, "Giá trị dự kiến không được âm").max(999_999_999_999).optional(),
    startDate: optionalDate,
    expectedEndDate: optionalDate,
    completedAt: optionalDate,
    contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    notes: optionalString(2000),
    customFieldValues: customFieldValuesSchema
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  })
  .refine((value) => value.status === undefined || value.status === "COMPLETED" || !value.completedAt, {
    message: "Chỉ nhập ngày hoàn thành khi dự án ở trạng thái Hoàn thành",
    path: ["completedAt"]
  })
  .refine((value) => !value.startDate || !value.completedAt || value.completedAt.getTime() >= value.startDate.getTime(), {
    message: "Ngày hoàn thành phải sau hoặc bằng ngày bắt đầu",
    path: ["completedAt"]
  });

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
