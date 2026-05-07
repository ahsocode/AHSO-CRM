import { z } from "zod";

export const mergeCustomerSchema = z.object({
  primaryId: z.string().trim().min(1, "Cần chọn bản ghi giữ lại"),
  duplicateIds: z.array(z.string().trim().min(1)).min(1, "Cần ít nhất một bản trùng lặp để gộp")
});

export type MergeCustomerDto = z.infer<typeof mergeCustomerSchema>;
