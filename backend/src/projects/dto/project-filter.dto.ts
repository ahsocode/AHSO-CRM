import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const projectFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  customerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  assignedToId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  view: z.enum(["list", "kanban"]).default("list")
});

export type ProjectFilterDto = z.infer<typeof projectFilterSchema>;
