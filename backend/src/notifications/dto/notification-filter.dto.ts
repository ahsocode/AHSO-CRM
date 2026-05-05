import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

export const notificationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  isRead: z
    .preprocess((value) => {
      if (value === undefined) return undefined;
      if (typeof value === "string") {
        if (value === "true") return true;
        if (value === "false") return false;
      }
      return value;
    }, z.boolean().optional()),
  type: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional())
});

export type NotificationFilterDto = z.infer<typeof notificationFilterSchema>;
