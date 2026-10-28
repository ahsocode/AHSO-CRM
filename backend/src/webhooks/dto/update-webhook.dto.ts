import { z } from "zod";
import { WEBHOOK_EVENT_NAMES, webhookUrlSchema } from "./create-webhook.dto";

export const updateWebhookSchema = z
  .object({
    url: webhookUrlSchema.optional(),
    events: z.array(z.enum(WEBHOOK_EVENT_NAMES)).min(1, "Cần chọn ít nhất một sự kiện").optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  });

export type UpdateWebhookDto = z.infer<typeof updateWebhookSchema>;

