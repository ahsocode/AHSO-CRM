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
  description: optionalString(1000),
  unit: optionalString(40),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm").max(999_999_999_999)
});

export const defaultQuoteTableColumnWidths = {
  index: 6,
  name: 41,
  description: 23,
  quantity: 6,
  unitPrice: 12,
  total: 12
};

export const quoteTableColumnWidthsSchema = z.object({
  index: z.coerce.number().min(3, "Tối thiểu 3%").max(25, "Tối đa 25%"),
  name: z.coerce.number().min(10, "Tối thiểu 10%").max(75, "Tối đa 75%"),
  description: z.coerce.number().min(10, "Tối thiểu 10%").max(75, "Tối đa 75%"),
  quantity: z.coerce.number().min(3, "Tối thiểu 3%").max(25, "Tối đa 25%"),
  unitPrice: z.coerce.number().min(6, "Tối thiểu 6%").max(40, "Tối đa 40%"),
  total: z.coerce.number().min(6, "Tối thiểu 6%").max(40, "Tối đa 40%")
});

export const quoteFormSchema = z.object({
  projectId: z.string().trim().min(1, "Dự án là bắt buộc"),
  validUntil: optionalDate,
  taxRate: z.coerce.number().min(0, "Thuế suất phải từ 0%").max(100, "Thuế suất tối đa 100%"),
  tableColumnWidths: quoteTableColumnWidthsSchema,
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
  tableColumnWidths: defaultQuoteTableColumnWidths,
  terms: "",
  deliveryTerms: "",
  internalNote: "",
  status: "DRAFT",
  items: [createEmptyQuoteItem()]
};
