import { z } from "zod";

export const draftEmailSchema = z.object({
  customerId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  quoteId: z.string().trim().optional(),
  recipientName: z.string().trim().max(120).optional(),
  purpose: z.string().trim().max(500).optional(),
  instruction: z.string().trim().max(500).optional(),
  tone: z.enum(["formal", "friendly", "urgent"]).default("formal"),
  additionalContext: z.string().trim().max(2_000).optional()
}).refine((data) => Boolean(data.purpose?.trim() || data.instruction?.trim()), {
  message: "Nội dung yêu cầu soạn email phải có ít nhất 5 ký tự",
  path: ["instruction"]
}).refine((data) => (data.purpose?.trim() ?? data.instruction?.trim() ?? "").length >= 5, {
  message: "Nội dung yêu cầu soạn email phải có ít nhất 5 ký tự",
  path: ["instruction"]
});

export type DraftEmailDto = z.infer<typeof draftEmailSchema>;
