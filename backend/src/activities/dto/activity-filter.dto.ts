import { z } from 'zod';
import { paginationSchema } from '../../common/dto/pagination.dto';

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const activityFilterSchema = paginationSchema.extend({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'SURVEY', 'DEMO', 'NOTE', 'FOLLOWUP']).optional(),
  customerId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  userId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  isCompleted: z
    .preprocess((value) => {
      if (value === '' || value === undefined || value === null) {
        return undefined;
      }

      if (value === 'true' || value === true) {
        return true;
      }

      if (value === 'false' || value === false) {
        return false;
      }

      return value;
    }, z.boolean().optional())
    .optional(),
});

export type ActivityFilterDto = z.infer<typeof activityFilterSchema>;
