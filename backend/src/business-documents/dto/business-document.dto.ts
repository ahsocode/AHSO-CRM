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

export const businessDocumentTypeSchema = z.enum([
  "RFQ",
  "CUSTOMER_PO",
  "QUOTATION",
  "SIGNED_QUOTATION",
  "PROPOSAL",
  "CONTRACT",
  "SIGNED_CONTRACT",
  "CONTRACT_ADDENDUM",
  "NDA",
  "DELIVERY_NOTE",
  "DOC_HANDOVER",
  "INSTALLATION_REPORT",
  "ACCEPTANCE_REPORT",
  "PARTIAL_ACCEPTANCE",
  "WARRANTY_CERT",
  "MAINTENANCE_RECORD",
  "PAYMENT_REQUEST",
  "PAYMENT_RECEIPT",
  "INVOICE",
  "AR_RECONCILIATION",
  "OTHER"
]);

export const businessDocumentSourceSchema = z.enum(["GENERATED", "UPLOADED", "RECEIVED", "SIGNED_UPLOAD"]);

export const businessDocumentStatusSchema = z.enum([
  "DRAFT",
  "ISSUED",
  "RECEIVED",
  "SIGNED",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
  "CANCELLED",
  "ARCHIVED"
]);

export const createBusinessDocumentSchema = z.object({
  type: businessDocumentTypeSchema,
  source: businessDocumentSourceSchema.default("UPLOADED"),
  status: businessDocumentStatusSchema.default("RECEIVED"),
  title: z.string().trim().min(2, "Tên tài liệu phải có ít nhất 2 ký tự").max(220),
  documentNo: optionalString(120),
  documentDate: optionalDate,
  notes: optionalString(2000),
  customerId: optionalString(80),
  projectId: optionalString(80),
  quoteId: optionalString(80),
  contractId: optionalString(80),
  paymentId: optionalString(80),
  generatedDocumentId: optionalString(80),
  parentId: optionalString(80)
});

export const updateBusinessDocumentSchema = createBusinessDocumentSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "Cần có ít nhất một trường để cập nhật"
  }
);

export const businessDocumentFileSchema = z.object({
  title: optionalString(220),
  documentNo: optionalString(120),
  documentDate: optionalDate,
  notes: optionalString(2000)
});

export const supersedeBusinessDocumentSchema = z.object({
  nextDocumentId: optionalString(80),
  reason: optionalString(1000)
});

export type CreateBusinessDocumentDto = z.infer<typeof createBusinessDocumentSchema>;
export type UpdateBusinessDocumentDto = z.infer<typeof updateBusinessDocumentSchema>;
export type BusinessDocumentFileDto = z.infer<typeof businessDocumentFileSchema>;
export type SupersedeBusinessDocumentDto = z.infer<typeof supersedeBusinessDocumentSchema>;
