import { z } from "zod";

export const bulkCustomerSchema = z.object({
  action: z.enum(["assign", "delete", "export"]),
  ids: z.array(z.string().trim().min(1)).min(1, "Cần chọn ít nhất một khách hàng"),
  assignedToId: z.string().trim().min(1).optional()
}).superRefine((value, ctx) => {
  if (value.action === "assign" && !value.assignedToId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assignedToId"],
      message: "Thiếu người phụ trách mới"
    });
  }
});

export type BulkCustomerDto = z.infer<typeof bulkCustomerSchema>;
