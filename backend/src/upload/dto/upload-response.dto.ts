import { z } from "zod";

export const uploadResponseSchema = z.object({
  url: z.string().min(1),
  filename: z.string(),
  size: z.number().positive(),
  mimeType: z.string().min(1)
});

export type UploadResponseDto = z.infer<typeof uploadResponseSchema>;
