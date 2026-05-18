import { z } from "zod";

export const bulkActionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  action: z.enum(["markRead", "markUnread", "star", "unstar", "delete"])
});

export type BulkActionDto = z.infer<typeof bulkActionSchema>;
