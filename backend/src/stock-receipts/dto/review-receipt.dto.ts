import { z } from "zod";

export const reviewReceiptSchema = z
  .object({ note: z.string().trim().max(500).optional() })
  .default({});
export type ReviewReceiptDto = z.infer<typeof reviewReceiptSchema>;
