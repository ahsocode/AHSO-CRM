import { z } from 'zod';

export const activityFormSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'SURVEY', 'DEMO', 'NOTE', 'FOLLOWUP'], {
    errorMap: () => ({ message: 'Loại hoạt động không hợp lệ' }),
  }),
  title: z.string().trim().min(2, 'Tiêu đề phải có ít nhất 2 ký tự').max(200),
  content: z.string().trim().max(5000).optional().or(z.literal('')),
  customerId: z.string().optional().or(z.literal('')),
  projectId: z.string().optional().or(z.literal('')),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
  scheduledAt: z.date().optional(),
  isCompleted: z.boolean().optional(),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;
