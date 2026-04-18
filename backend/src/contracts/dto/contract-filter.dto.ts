import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const contractFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  status: z.enum(["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]).optional(),
  projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  customerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
});

export type ContractFilterDto = z.infer<typeof contractFilterSchema>;
