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

const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Ngày hiệu lực không hợp lệ")
    .optional()
);

export const quoteItemFormSchema = z.object({
  name: z.string().trim().min(2, "Tên hạng mục phải có ít nhất 2 ký tự").max(180),
  description: optionalString(600),
  unit: optionalString(40),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm").max(999_999_999_999)
});

export const quoteFormSchema = z.object({
  projectId: z.string().trim().min(1, "Dự án là bắt buộc"),
  validUntil: optionalDate,
  taxRate: z.coerce.number().min(0, "Thuế suất phải từ 0%").max(100, "Thuế suất tối đa 100%"),
  terms: optionalString(2000),
  deliveryTerms: optionalString(2000),
  internalNote: optionalString(2000),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
  items: z.array(quoteItemFormSchema).min(1, "Ít nhất phải có 1 hạng mục").max(50)
});

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export const createEmptyQuoteItem = (): QuoteFormValues["items"][number] => ({
  name: "",
  description: "",
  unit: "",
  quantity: 1,
  unitPrice: 0
});

const defaultValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const defaultQuoteFormValues: QuoteFormValues = {
  projectId: "",
  validUntil: defaultValidUntil,
  taxRate: 10,
  terms: "Thanh toán 50% khi xác nhận đơn hàng, phần còn lại khi nghiệm thu hoàn tất.",
  deliveryTerms: "Thời gian triển khai dự kiến từ 15 đến 30 ngày kể từ ngày xác nhận PO.",
  internalNote: "",
  status: "DRAFT",
  items: [createEmptyQuoteItem()]
};
