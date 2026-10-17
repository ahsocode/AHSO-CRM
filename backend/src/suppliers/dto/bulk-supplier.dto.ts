import { z } from "zod";

export const bulkSupplierSchema = z.object({
  action: z.literal("export"),
  ids: z.array(z.string().min(1)).min(1, "Chưa chọn nhà cung cấp nào").max(500),
});

export type BulkSupplierDto = z.infer<typeof bulkSupplierSchema>;
