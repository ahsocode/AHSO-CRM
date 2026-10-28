import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const CONTRACT_SORT_FIELDS = [
  "updatedAt",
  "createdAt",
  "contractNo",
  "value",
  "signDate",
  "startDate"
] as const;

const booleanFromQuery = (value: unknown) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
};

export const contractFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  status: z.enum(["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"]).optional(),
  projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  customerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  includeCancelled: z.preprocess(booleanFromQuery, z.boolean().optional()),
  sortBy: z.preprocess(emptyToUndefined, z.enum(CONTRACT_SORT_FIELDS).optional()),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).optional())
});

export type ContractFilterDto = z.infer<typeof contractFilterSchema>;
