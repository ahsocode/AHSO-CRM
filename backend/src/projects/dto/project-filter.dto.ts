import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const PROJECT_SORT_FIELDS = ["updatedAt", "createdAt", "code", "estimatedValue", "expectedEndDate", "name"] as const;

const queryBoolean = z.preprocess(
  (value) => (value === "true" || value === "1" || value === true ? true : value === "false" || value === "0" || value === false ? false : value),
  z.boolean().optional()
);

export const projectFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  customerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  assignedToId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  view: z.enum(["list", "kanban"]).default("list"),
  sortBy: z.enum(PROJECT_SORT_FIELDS).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  // List view hides COMPLETED/LOST unless this is true (an explicit `status` always wins).
  includeClosed: queryBoolean
});

export type ProjectFilterDto = z.infer<typeof projectFilterSchema>;
