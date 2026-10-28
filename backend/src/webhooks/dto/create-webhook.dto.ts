import { z } from "zod";
import { checkWebhookUrl } from "../webhook-url-guard";

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

// Protocol is always checked; internal targets are rejected only in production
// (see webhook-url-guard.ts). Delivery re-checks with DNS resolution.
export const webhookUrlSchema = z
  .string()
  .trim()
  .url("Webhook URL không hợp lệ")
  .superRefine((value, ctx) => {
    const verdict = checkWebhookUrl(value);
    if (!verdict.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: verdict.reason });
    }
  });

export const createWebhookSchema = z.object({
  url: webhookUrlSchema,
  events: z
    .array(z.enum(WEBHOOK_EVENT_NAMES))
    .min(1, "Cần chọn ít nhất một sự kiện")
    .max(WEBHOOK_EVENT_NAMES.length, "Danh sách sự kiện không hợp lệ"),
  isActive: z.boolean().optional()
});

export type CreateWebhookDto = z.infer<typeof createWebhookSchema>;
export type WebhookEventName = (typeof WEBHOOK_EVENT_NAMES)[number];

