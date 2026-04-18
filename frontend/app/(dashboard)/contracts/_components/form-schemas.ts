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

export const milestoneFormSchema = z.object({
  name: z.string().trim().min(2, "Tên milestone phải có ít nhất 2 ký tự").max(160),
  description: optionalString(800),
  dueDate: optionalDateString,
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "ACCEPTED"]),
  paymentAmount: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0, "Ngân sách milestone không được âm").optional()
  ),
  notes: optionalString(1200)
});

export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

export const defaultMilestoneFormValues: MilestoneFormValues = {
  name: "",
  description: "",
  dueDate: "",
  status: "PENDING",
  paymentAmount: undefined,
  notes: ""
};

export const paymentFormSchema = z.object({
  amount: z.coerce.number().positive("Giá trị thanh toán phải lớn hơn 0").max(999_999_999_999),
  paidAt: z
    .string()
    .trim()
    .min(1, "Ngày thanh toán là bắt buộc")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày thanh toán không hợp lệ"),
  method: optionalString(60),
  reference: optionalString(120),
  notes: optionalString(1000)
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const defaultPaymentFormValues: PaymentFormValues = {
  amount: 0,
  paidAt: new Date().toISOString().slice(0, 10),
  method: "",
  reference: "",
  notes: ""
};
