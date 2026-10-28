import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const quoteFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
  projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  customerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  createdById: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  // Báo giá DRAFT/SENT có validUntil trong N ngày tới (khớp KPI "Sắp hết hạn").
  expiringWithinDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(90).optional())
});

export type QuoteFilterDto = z.infer<typeof quoteFilterSchema>;
