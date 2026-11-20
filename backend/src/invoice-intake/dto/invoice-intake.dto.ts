import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optStr = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optId = () => z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());

export const LINE_KINDS = ["GOODS", "SERVICE", "EXPENSE"] as const;
export const COST_GROUPS = [
  "MECHANICAL", "ELECTRICAL", "VISION", "SOFTWARE", "LABOR", "OUTSOURCE", "SHIPPING", "TRAVEL", "OTHER"
] as const;
export const INTAKE_SOURCES = ["EMAIL_AUTO", "IMPORT", "MANUAL"] as const;
export const INTAKE_INVOICE_TYPES = ["PURCHASE", "REPLACEMENT", "ADJUSTMENT"] as const;

export const matchLineSchema = z
  .object({
    supplierId: optId(),
    supplierTaxCode: optStr(20),
    itemCode: optStr(100),
    itemName: z.string().trim().min(1, "Tên hàng là bắt buộc").max(500),
    unit: optStr(30)
  })
  .refine((v) => v.supplierId || v.supplierTaxCode, { message: "Cần supplierId hoặc supplierTaxCode" });
export type MatchLineDto = z.infer<typeof matchLineSchema>;

export const saveAliasSchema = z
  .object({
    supplierId: optId(),
    supplierTaxCode: optStr(20),
    supplierItemCode: optStr(100),
    supplierItemName: z.string().trim().min(1, "Tên hàng của NCC là bắt buộc").max(500),
    supplierUnit: optStr(30),
    materialId: z.string().trim().min(1, "Vật tư là bắt buộc"),
    unitConversion: z.coerce.number().positive("Hệ số quy đổi phải lớn hơn 0").optional()
  })
  .refine((v) => v.supplierId || v.supplierTaxCode, { message: "Cần supplierId hoặc supplierTaxCode" });
export type SaveAliasDto = z.infer<typeof saveAliasSchema>;

export const pendingLineFilterSchema = z.object({
  status: z.enum(["PENDING", "RESOLVED", "DISCARDED"]).optional(),
  supplierId: optId(),
  receiptId: optId(),
  projectId: optId(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20)
});
export type PendingLineFilterDto = z.infer<typeof pendingLineFilterSchema>;

export const resolvePendingLineSchema = z.object({
  materialId: z.string().trim().min(1, "Vật tư là bắt buộc"),
  saveAlias: z.boolean().default(true),
  unitConversion: z.coerce.number().positive().optional()
});
export type ResolvePendingLineDto = z.infer<typeof resolvePendingLineSchema>;

export const discardPendingLineSchema = z.object({
  reason: z.string().trim().min(3, "Cần nhập lý do bỏ dòng").max(500)
});
export type DiscardPendingLineDto = z.infer<typeof discardPendingLineSchema>;

export const pendingReviewFilterSchema = z.object({
  source: z.enum(INTAKE_SOURCES).optional(),
  supplierId: optId(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20)
});
export type PendingReviewFilterDto = z.infer<typeof pendingReviewFilterSchema>;

const invoiceLineSchema = z.object({
  lineNo: z.coerce.number().int().min(1),
  code: optStr(100),
  name: z.string().trim().min(1, "Tên hàng là bắt buộc").max(500),
  unit: optStr(30),
  qty: z.coerce.number().positive("Số lượng phải lớn hơn 0"),
  // Unit price EXCLUDING VAT
  unitPrice: z.coerce.number().min(0, "Đơn giá không được âm"),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  vatAmount: z.coerce.number().min(0).optional(),
  lineKind: z.enum(LINE_KINDS).default("GOODS"),
  materialId: optId(),
  projectId: optId(),
  costGroup: z.enum(COST_GROUPS).optional()
});

export const createReceiptFromInvoiceSchema = z.object({
  sellerTaxCode: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") : v),
    z.string().min(1, "MST người bán là bắt buộc").max(20)
  ),
  series: z.string().trim().min(1, "Ký hiệu hóa đơn là bắt buộc").max(30),
  number: z.string().trim().min(1, "Số hóa đơn là bắt buộc").max(50),
  date: z.coerce.date(),
  receiptDate: z.coerce.date().optional(),
  supplierId: optId(),
  supplierName: optStr(300),
  warehouseId: optId(),
  vatTotal: z.coerce.number().min(0).optional(),
  totalDeclared: z.coerce.number().min(0).optional(),
  fileRef: optStr(500),
  lookupCode: optStr(100),
  notes: optStr(2000),
  source: z.enum(INTAKE_SOURCES),
  invoiceType: z.enum(INTAKE_INVOICE_TYPES).default("PURCHASE"),
  relatedInvoiceRef: optStr(200),
  lines: z.array(invoiceLineSchema).min(1, "Hóa đơn phải có ít nhất 1 dòng").max(300)
});
export type CreateReceiptFromInvoiceDto = z.infer<typeof createReceiptFromInvoiceSchema>;
export type InvoiceLineDto = CreateReceiptFromInvoiceDto["lines"][number];
