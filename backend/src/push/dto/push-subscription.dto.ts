import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url("Endpoint push không hợp lệ"),
  keys: z.object({
    p256dh: z.string().trim().min(1, "Thiếu khóa p256dh"),
    auth: z.string().trim().min(1, "Thiếu khóa auth")
  })
});

export type PushSubscriptionDto = z.infer<typeof pushSubscriptionSchema>;
