import { z } from "zod";

export const updateSignatureSchema = z.object({
  signature: z.string().max(5000)
});

export type UpdateSignatureDto = z.infer<typeof updateSignatureSchema>;
