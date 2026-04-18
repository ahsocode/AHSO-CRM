import { z } from "zod";

export const uploadResponseSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  size: z.number().positive(),
  uploadedAt: z.string().datetime()
});

export type UploadResponseDto = z.infer<typeof uploadResponseSchema>;
