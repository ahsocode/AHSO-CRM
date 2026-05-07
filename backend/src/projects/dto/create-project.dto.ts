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

export const createProjectSchema = z
  .object({
    customerId: z.string().trim().min(1, "Khách hàng là bắt buộc"),
    name: z.string().trim().min(2, "Tên dự án phải có ít nhất 2 ký tự").max(180),
    description: optionalString(1000),
    status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]).default("SURVEY"),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
    estimatedValue: z.coerce.number().min(0, "Giá trị dự kiến không được âm").max(999_999_999_999).optional(),
    startDate: optionalDate,
    expectedEndDate: optionalDate,
    contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    notes: optionalString(2000),
    customFieldValues: customFieldValuesSchema
  })
  .refine(
    (value) =>
      !value.startDate || !value.expectedEndDate || value.expectedEndDate.getTime() >= value.startDate.getTime(),
    {
      message: "Ngày kết thúc dự kiến phải sau hoặc bằng ngày bắt đầu",
      path: ["expectedEndDate"]
    }
  );

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
