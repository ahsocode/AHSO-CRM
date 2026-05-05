import { z } from "zod";

export const draftEmailSchema = z.object({
  customerId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  recipientName: z.string().trim().max(120).optional(),
  purpose: z.string().trim().min(5, "Mục đích email phải có ít nhất 5 ký tự").max(500),
  tone: z.enum(["formal", "friendly", "urgent"]).default("formal"),
  additionalContext: z.string().trim().max(2_000).optional()
});

export type DraftEmailDto = z.infer<typeof draftEmailSchema>;
