import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const stockReceiptFilterSchema = paginationSchema.extend({
  warehouseId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  supplierId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
  dateFrom: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  dateTo: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  invoiceNumber: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  invoiceSeries: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  sellerTaxCode: z.preprocess(
    (v) => (typeof v === "string" ? emptyToUndefined(v.replace(/\s+/g, "")) : v),
    z.string().max(20).optional()
  ),
  invoiceDateFrom: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  invoiceDateTo: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  hasInvoice: z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean().optional()),
});

export type StockReceiptFilterDto = z.infer<typeof stockReceiptFilterSchema>;
