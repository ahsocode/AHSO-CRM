import { z } from "zod";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses lockedUntil: a date-only value is normalised to the end of that UTC day so documents dated
 * anywhere on the locked day are blocked. Returns null for null input, Invalid Date for garbage.
 */
export function parseLockedUntil(value: string | null): Date | null {
  if (value === null) return null;
  return new Date(DATE_ONLY.test(value) ? `${value}T23:59:59.999Z` : value);
}

/** lockedUntil: ISO date/datetime, or null to unlock. reason is mandatory for set and unlock alike. */
export const setPeriodLockSchema = z.object({
  lockedUntil: z
    .string()
    .trim()
    .nullable()
    .refine((value) => value === null || !Number.isNaN((parseLockedUntil(value) as Date).getTime()), "Ngày khóa sổ không hợp lệ"),
  reason: z.string().trim().min(5, "Lý do tối thiểu 5 ký tự").max(500)
});

export type SetPeriodLockDto = z.infer<typeof setPeriodLockSchema>;
