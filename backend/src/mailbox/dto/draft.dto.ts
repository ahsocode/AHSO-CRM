import { z } from "zod";

export const saveDraftSchema = z.object({
  draftId: z.string().optional(),
  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  bcc: z.array(z.string()).default([]),
  subject: z.string().default(""),
  bodyHtml: z.string().default("")
});

export type SaveDraftDto = z.infer<typeof saveDraftSchema>;
