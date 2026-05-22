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

export const createQuoteItemSchema = z.object({
  name: z.string().trim().min(2, "Tên hạng mục phải có ít nhất 2 ký tự").max(180),
  description: optionalString(600),
  unit: optionalString(40),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm").max(999_999_999_999)
});

export const quoteTableColumnWidthsSchema = z.object({
  index: z.coerce.number().min(3).max(25),
  name: z.coerce.number().min(10).max(75),
  description: z.coerce.number().min(10).max(75),
  quantity: z.coerce.number().min(3).max(25),
  unitPrice: z.coerce.number().min(6).max(40),
  total: z.coerce.number().min(6).max(40)
});

export const createQuoteSchema = z.object({
  projectId: z.string().trim().min(1, "Dự án là bắt buộc"),
  validUntil: optionalDate,
  taxRate: z.coerce.number().min(0, "Thuế suất phải từ 0%").max(100, "Thuế suất tối đa 100%").default(10),
  tableColumnWidths: quoteTableColumnWidthsSchema.optional(),
  terms: optionalString(2000),
  deliveryTerms: optionalString(2000),
  internalNote: optionalString(2000),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).default("DRAFT"),
  items: z.array(createQuoteItemSchema).min(1, "Ít nhất phải có 1 hạng mục").max(50)
});

export type CreateQuoteDto = z.infer<typeof createQuoteSchema>;
