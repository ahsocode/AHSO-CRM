import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Từ khóa tìm kiếm là bắt buộc"),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8)
});

export type SearchQueryDto = z.infer<typeof searchQuerySchema>;
