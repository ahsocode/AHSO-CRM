import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const customerFilterSchema = paginationSchema.extend({
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE"]).optional(),
  industry: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  assignedToId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  isVip: z
    .preprocess((value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined;
      }

      if (value === "true" || value === true) {
        return true;
      }

      if (value === "false" || value === false) {
        return false;
      }

      return value;
    }, z.boolean().optional())
    .optional()
});

export type CustomerFilterDto = z.infer<typeof customerFilterSchema>;

