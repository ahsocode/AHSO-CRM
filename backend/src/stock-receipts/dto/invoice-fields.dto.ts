import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

// Update semantics: omitted = keep, null / "" = clear.
const emptyToNull = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const stripSpaces = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, "") : value);

export const INVOICE_TYPES = ["NORMAL", "REPLACEMENT", "ADJUSTMENT"] as const;

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

const clearableString = (maxLength: number) =>
  z.preprocess(emptyToNull, z.string().max(maxLength).nullable().optional());

/** Invoice fields accepted when creating / editing a DRAFT receipt (empty = not provided). */
export const invoiceFieldsShape = {
  invoiceSeries: optionalString(30),
  invoiceNumber: optionalString(50),
  invoiceDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  sellerTaxCode: z.preprocess((v) => emptyToUndefined(stripSpaces(v)), z.string().max(20).optional()),
  invoiceFileRef: optionalString(500),
  invoiceLookupCode: optionalString(100),
  invoiceType: z.preprocess(emptyToUndefined, z.enum(INVOICE_TYPES).optional()),
  relatedInvoiceRef: optionalString(200),
};

/** Invoice fields for PATCH /stock-receipts/:id/invoice (null clears a field). */
export const invoicePatchShape = {
  invoiceSeries: clearableString(30),
  invoiceNumber: clearableString(50),
  invoiceDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  sellerTaxCode: z.preprocess((v) => emptyToNull(stripSpaces(v)), z.string().max(20).nullable().optional()),
  invoiceFileRef: clearableString(500),
  invoiceLookupCode: clearableString(100),
  invoiceType: z.preprocess(emptyToUndefined, z.enum(INVOICE_TYPES).optional()),
  relatedInvoiceRef: clearableString(200),
};

export const updateReceiptInvoiceSchema = z.object(invoicePatchShape);
export type UpdateReceiptInvoiceDto = z.infer<typeof updateReceiptInvoiceSchema>;

const bulkRowSchema = z
  .object({
    receiptId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    receiptNo: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    ...invoicePatchShape,
  })
  .refine((row) => row.receiptId || row.receiptNo, {
    message: "Cần receiptId hoặc receiptNo",
  });

/** Accepts either a bare array or { items: [...] }. */
export const bulkReceiptInvoicesSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { items: value } : value),
  z.object({
    items: z.array(bulkRowSchema).min(1, "Chưa có dòng nào").max(500, "Tối đa 500 dòng mỗi lần"),
  })
);

export type BulkReceiptInvoicesDto = z.infer<typeof bulkReceiptInvoicesSchema>;
export type BulkReceiptInvoiceRow = BulkReceiptInvoicesDto["items"][number];
