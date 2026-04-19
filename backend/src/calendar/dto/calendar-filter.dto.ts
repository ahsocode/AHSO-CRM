import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

export const calendarFilterSchema = paginationSchema
  .extend({
    // Calendar view needs to render a full week at once, so raise the cap.
    limit: z.coerce.number().int().min(1).max(500).default(200),
    search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    isCompleted: optionalBoolean,
    type: z.enum(["CALL", "EMAIL", "MEETING", "SURVEY", "DEMO", "NOTE", "FOLLOWUP"]).optional(),
    assigneeId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    customerId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
    projectId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateTo.getTime() >= value.dateFrom.getTime(),
    {
      message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
      path: ["dateTo"]
    }
  );

export type CalendarFilterDto = z.infer<typeof calendarFilterSchema>;
