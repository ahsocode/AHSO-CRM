import { z } from "zod";

export const webhookLogFilterSchema = z.object({
  page: z.coerce.number().int().positive().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

export type WebhookLogFilterDto = z.infer<typeof webhookLogFilterSchema>;

