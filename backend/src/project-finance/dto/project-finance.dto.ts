import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optionalId = z.preprocess(emptyToUndefined, z.string().trim().min(1).optional());
const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const vnd = (label: string) =>
  z.coerce.number({ invalid_type_error: `${label} phải là số` }).min(0, `${label} không được âm`).max(999_999_999_999);

const pagination = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
};

/* ---------- Sales invoices ---------- */

export const createSalesInvoiceSchema = z.object({
  projectId: z.string().trim().min(1, "Dự án là bắt buộc"),
  contractId: optionalId,
  series: z.string().trim().min(1, "Ký hiệu hóa đơn là bắt buộc").max(20),
  number: z.string().trim().min(1, "Số hóa đơn là bắt buộc").max(30),
  date: z.coerce.date(),
  buyerTaxCode: optionalString(20),
  amountExVat: vnd("Tiền chưa VAT"),
  vatAmount: vnd("Tiền VAT").default(0),
  notes: optionalString(1000)
});

export const salesInvoiceFilterSchema = z.object({
  projectId: optionalId,
  contractId: optionalId,
  status: z.preprocess(emptyToUndefined, z.enum(["ISSUED", "CANCELLED", "REPLACED"]).optional()),
  series: optionalString(20),
  number: optionalString(30),
  dateFrom: optionalDate,
  dateTo: optionalDate,
  ...pagination
});

export const cancelSalesInvoiceSchema = z.object({
  reason: z.string().trim().min(5, "Lý do hủy tối thiểu 5 ký tự").max(500),
  replacedByInvoiceId: optionalId
});

/* ---------- Cost recognition ---------- */

export const recognizeCostSchema = z.object({
  action: z.enum(["DELIVER", "REOPEN"]),
  reason: optionalString(500),
  /** ADMIN-only: allow DELIVER with no sales invoice (reason required). */
  overrideNoInvoice: z.boolean().optional(),
  recognizedAt: optionalDate
});

/* ---------- Expense project costs ---------- */

export const createExpenseCostSchema = z.object({
  projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).nullish()),
  category: z.string().trim().min(1, "Nhóm chi phí là bắt buộc").max(100),
  description: z.string().trim().min(1, "Nội dung chi phí là bắt buộc").max(300),
  amount: vnd("Số tiền"),
  vatRate: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(100).nullish()),
  vatAmount: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(0).max(999_999_999_999).nullish()),
  invoiceDate: z.coerce.date(),
  invoiceNo: optionalString(60),
  invoiceSeries: optionalString(20),
  invoiceNumber: optionalString(30),
  sellerTaxCode: optionalString(20),
  supplierId: optionalId,
  notes: optionalString(1000)
});

export const expenseCostFilterSchema = z.object({
  projectId: optionalId,
  unassignedOnly: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean().optional()),
  group: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  dateFrom: optionalDate,
  dateTo: optionalDate,
  ...pagination
});

export const assignCostSchema = z.object({
  projectId: z.string().trim().min(1, "Dự án là bắt buộc")
});

/* ---------- Common allocations ---------- */

export const commonAllocationSchema = z
  .object({
    periodFrom: z.coerce.date(),
    periodTo: z.coerce.date(),
    mode: z.enum(["PREVIEW", "CONFIRM"]).default("PREVIEW"),
    basis: z.enum(["REVENUE", "DIRECT_COST", "MANUAL"]).default("REVENUE"),
    manualShares: z
      .array(z.object({ projectId: z.string().trim().min(1), share: z.coerce.number().positive("Tỷ trọng phải > 0") }))
      .max(200)
      .optional()
  })
  .refine((v) => v.periodFrom.getTime() <= v.periodTo.getTime(), {
    message: "Ngày bắt đầu kỳ phải trước hoặc bằng ngày kết thúc kỳ",
    path: ["periodTo"]
  })
  .refine((v) => v.basis !== "MANUAL" || (v.manualShares?.length ?? 0) > 0, {
    message: "Phân bổ thủ công cần danh sách tỷ trọng (manualShares)",
    path: ["manualShares"]
  });

export const commonAllocationFilterSchema = z.object({
  dateFrom: optionalDate,
  dateTo: optionalDate,
  ...pagination
});

export type CreateSalesInvoiceDto = z.infer<typeof createSalesInvoiceSchema>;
export type SalesInvoiceFilterDto = z.infer<typeof salesInvoiceFilterSchema>;
export type CancelSalesInvoiceDto = z.infer<typeof cancelSalesInvoiceSchema>;
export type RecognizeCostDto = z.infer<typeof recognizeCostSchema>;
export type CreateExpenseCostDto = z.infer<typeof createExpenseCostSchema>;
export type ExpenseCostFilterDto = z.infer<typeof expenseCostFilterSchema>;
export type AssignCostDto = z.infer<typeof assignCostSchema>;
export type CommonAllocationDto = z.infer<typeof commonAllocationSchema>;
export type CommonAllocationFilterDto = z.infer<typeof commonAllocationFilterSchema>;
