import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isValidDateOnly = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const dateOnlySchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
    .refine(isValidDateOnly, "Ngày không hợp lệ")
    .optional()
);

export const dashboardFilterSchema = z
  .object({
    dateFrom: dateOnlySchema,
    dateTo: dateOnlySchema
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "Đến ngày phải sau hoặc bằng Từ ngày"
      });
    }
  });

export type DashboardFilterDto = z.infer<typeof dashboardFilterSchema>;
