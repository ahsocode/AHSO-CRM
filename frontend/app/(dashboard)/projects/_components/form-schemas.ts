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

const optionalDateString = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
    .optional()
);

export const projectFormSchema = z
  .object({
    customerId: z.string().trim().min(1, "Khách hàng là bắt buộc"),
    name: z.string().trim().min(2, "Tên dự án phải có ít nhất 2 ký tự").max(180),
    description: optionalString(1000),
    status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]),
    priority: z.enum(["LOW", "NORMAL", "HIGH"]),
    estimatedValue: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0, "Giá trị dự kiến không được âm").max(999_999_999_999).optional()
    ),
    startDate: optionalDateString,
    expectedEndDate: optionalDateString,
    completedAt: optionalDateString,
    contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    notes: optionalString(2000)
  })
  .refine(
    (value) =>
      !value.startDate || !value.expectedEndDate || value.expectedEndDate >= value.startDate,
    {
      message: "Ngày kết thúc dự kiến phải sau hoặc bằng ngày bắt đầu",
      path: ["expectedEndDate"]
    }
  )
  .refine((value) => value.status === "COMPLETED" || !value.completedAt, {
    message: "Chỉ nhập ngày hoàn thành khi dự án ở trạng thái Hoàn thành",
    path: ["completedAt"]
  })
  .refine((value) => !value.startDate || !value.completedAt || value.completedAt >= value.startDate, {
    message: "Ngày hoàn thành phải sau hoặc bằng ngày bắt đầu",
    path: ["completedAt"]
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const defaultProjectFormValues: ProjectFormValues = {
  customerId: "",
  name: "",
  description: "",
  status: "SURVEY",
  priority: "NORMAL",
  estimatedValue: undefined,
  startDate: "",
  expectedEndDate: "",
  completedAt: "",
  contactId: undefined,
  notes: ""
};
