import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const stockTransferFilterSchema = paginationSchema.extend({
  warehouseId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  status: z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]).optional(),
  dateFrom: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  dateTo: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
});

export type StockTransferFilterDto = z.infer<typeof stockTransferFilterSchema>;
