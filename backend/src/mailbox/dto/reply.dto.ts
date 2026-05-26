import { z } from "zod";

export const replySchema = z.object({
  bodyHtml: z.string().min(1, "Nội dung trả lời là bắt buộc"),
  bodyText: z.string().optional(),
  replyAll: z.boolean().default(false),
  attachments: z.array(z.string().trim().min(1)).default([])
});

export type ReplyDto = z.infer<typeof replySchema>;
