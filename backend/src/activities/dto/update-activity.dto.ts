import { z } from 'zod';

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const updateActivitySchema = z.object({
  title: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(200).optional(),
  content: optionalString(5000),
  isCompleted: z.boolean().optional(),
  scheduledAt: z.string().datetime().or(z.date()).optional(), // Support drag-drop reschedule
});

export type UpdateActivityDto = z.infer<typeof updateActivitySchema>;
