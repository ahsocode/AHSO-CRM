import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const reportFilterSchema = z.object({
  months: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(24).default(6)),
  topLimit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(20).default(5))
});

export type ReportFilterDto = z.infer<typeof reportFilterSchema>;
