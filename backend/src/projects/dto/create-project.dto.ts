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
    completedAt: optionalDate,
    salesInvoiceDate: optionalDate,
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
  )
  .refine((value) => value.status === "COMPLETED" || !value.completedAt, {
    message: "Chỉ nhập ngày hoàn thành khi dự án ở trạng thái Hoàn thành",
    path: ["completedAt"]
  })
  .refine((value) => value.status === "COMPLETED" || !value.salesInvoiceDate, {
    message: "Chỉ nhập ngày hóa đơn bán ra khi dự án ở trạng thái Hoàn thành",
    path: ["salesInvoiceDate"]
  })
  .refine((value) => value.status !== "COMPLETED" || Boolean(value.salesInvoiceDate), {
    message: "Ngày hóa đơn bán ra là bắt buộc khi hoàn thành dự án",
    path: ["salesInvoiceDate"]
  })
  .refine((value) => !value.startDate || !value.completedAt || value.completedAt.getTime() >= value.startDate.getTime(), {
    message: "Ngày hoàn thành phải sau hoặc bằng ngày bắt đầu",
    path: ["completedAt"]
  });

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
