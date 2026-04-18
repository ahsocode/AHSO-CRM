import { z } from "zod";

export const updateQuoteStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"])
});

export type UpdateQuoteStatusDto = z.infer<typeof updateQuoteStatusSchema>;
