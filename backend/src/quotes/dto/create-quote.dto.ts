import { z } from "zod";
import { buildQuoteTotals } from "../quote-helpers";

// Decimal(15,0) column ceiling for QuoteItem.total and Quote.subtotal/taxAmount/total
export const MAX_QUOTE_AMOUNT = 999_999_999_999_999;

const isValidAmount = (value: number) =>
  Number.isSafeInteger(value) && value >= 0 && value <= MAX_QUOTE_AMOUNT;

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;

// Per-line VAT percent. null = KCT (không chịu thuế), distinct from 0 (thuế suất 0%).
// Omitted (undefined) = use the quote's default taxRate; the service persists the resolved value.
// Not z.coerce: coercing null would silently turn KCT into 0%.
export const itemTaxRateSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : undefined;
  },
  z
    .number({ invalid_type_error: "Thuế suất dòng phải là số hoặc KCT" })
    .finite()
    .min(0, "Thuế suất phải từ 0%")
    .max(100, "Thuế suất tối đa 100%")
    .refine(hasAtMostTwoDecimals, "Thuế suất tối đa 2 chữ số thập phân")
    .nullable()
    .optional()
);

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const createQuoteItemSchema = z.object({
  name: z.string().trim().min(2, "Tên hạng mục phải có ít nhất 2 ký tự").max(180),
  description: optionalString(1000),
  unit: optionalString(40),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm").max(999_999_999_999),
  taxRate: itemTaxRateSchema,
  // Internal cost breakdown (BOM of the same project); never printed on the quote
  bomId: z.preprocess(emptyToUndefined, z.string().trim().min(1).nullish())
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
}).superRefine((quote, ctx) => {
  // Reject totals that would overflow the DB columns instead of failing with a 500.
  // Totals use per-line VAT (omitted line rate = quote.taxRate), exactly as the service persists them.
  const lineTotals = quote.items.map((item) => Math.round(item.quantity * item.unitPrice));
  const badLine = lineTotals.findIndex((total) => !isValidAmount(total));
  if (badLine >= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items", badLine],
      message: "Thành tiền của hạng mục vượt giới hạn cho phép"
    });
    return;
  }

  const { subtotal, taxAmount, total } = buildQuoteTotals(quote.items, quote.taxRate);
  if (!isValidAmount(subtotal) || !isValidAmount(taxAmount) || !isValidAmount(total)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [!isValidAmount(subtotal) ? "items" : "taxRate"],
      message: "Tổng giá trị báo giá vượt giới hạn cho phép"
    });
  }
});

export type CreateQuoteDto = z.infer<typeof createQuoteSchema>;
