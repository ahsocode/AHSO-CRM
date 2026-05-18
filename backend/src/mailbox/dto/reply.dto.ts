import { z } from "zod";

export const replySchema = z.object({
  bodyHtml: z.string().min(1, "Nội dung trả lời là bắt buộc"),
  bodyText: z.string().optional(),
  replyAll: z.boolean().default(false)
});

export type ReplyDto = z.infer<typeof replySchema>;
