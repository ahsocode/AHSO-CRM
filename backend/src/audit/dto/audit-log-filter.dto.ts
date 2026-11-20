import { z } from "zod";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses an ISO date/datetime; a date-only `to` is inclusive (end of that UTC day). */
export function parseAuditBoundary(value: string, isEnd: boolean): Date {
  return new Date(DATE_ONLY.test(value) && isEnd ? `${value}T23:59:59.999Z` : value);
}

const dateString = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(parseAuditBoundary(value, false).getTime()), "Ngày không hợp lệ");

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().positive().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  userId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  resource: z.string().trim().min(1).optional(),
  resourceId: z.string().trim().min(1).optional(),
  from: dateString.optional(),
  to: dateString.optional()
});

export type AuditLogFilterDto = z.infer<typeof auditLogFilterSchema>;
