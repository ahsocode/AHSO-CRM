import { z } from "zod";

export const WEBHOOK_EVENT_NAMES = [
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "project.created",
  "project.status_changed",
  "quote.sent",
  "quote.accepted",
  "contract.signed",
  "contract.completed",
  "payment.received"
] as const;

export const createWebhookSchema = z.object({
  url: z.string().trim().url("Webhook URL không hợp lệ"),
  events: z
    .array(z.enum(WEBHOOK_EVENT_NAMES))
    .min(1, "Cần chọn ít nhất một sự kiện")
    .max(WEBHOOK_EVENT_NAMES.length, "Danh sách sự kiện không hợp lệ"),
  isActive: z.boolean().optional()
});

export type CreateWebhookDto = z.infer<typeof createWebhookSchema>;
export type WebhookEventName = (typeof WEBHOOK_EVENT_NAMES)[number];

