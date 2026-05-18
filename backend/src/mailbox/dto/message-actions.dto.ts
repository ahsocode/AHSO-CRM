import { z } from "zod";

export const markReadSchema = z.object({
  isRead: z.boolean()
});

export const starMessageSchema = z.object({
  isStarred: z.boolean()
});

export type MarkReadDto = z.infer<typeof markReadSchema>;
export type StarMessageDto = z.infer<typeof starMessageSchema>;
