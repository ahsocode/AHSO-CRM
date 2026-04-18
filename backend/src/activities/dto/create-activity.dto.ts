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

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url('URL không hợp lệ').optional()
);

export const createActivitySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'SURVEY', 'DEMO', 'NOTE', 'FOLLOWUP'], {
    errorMap: () => ({ message: 'Loại hoạt động không hợp lệ' }),
  }),
  title: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(200),
  content: optionalString(5000),
  customerId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  attachmentUrl: optionalUrl,
  scheduledAt: z.preprocess(
    (val) => (typeof val === 'string' ? new Date(val) : val),
    z.date().optional()
  ),
});

export type CreateActivityDto = z.infer<typeof createActivitySchema>;
