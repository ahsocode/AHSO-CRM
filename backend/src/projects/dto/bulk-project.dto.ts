import { z } from "zod";

export const bulkProjectSchema = z.object({
  action: z.enum(["status", "delete", "export"]),
  ids: z.array(z.string().trim().min(1)).min(1, "Cần chọn ít nhất một dự án"),
  status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"]).optional()
}).superRefine((value, ctx) => {
  if (value.action === "status" && !value.status) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "Thiếu trạng thái mới"
    });
  }
});

export type BulkProjectDto = z.infer<typeof bulkProjectSchema>;
