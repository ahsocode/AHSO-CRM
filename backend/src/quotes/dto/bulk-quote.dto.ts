import { z } from "zod";

export const bulkQuoteSchema = z.object({
  action: z.enum(["status", "send", "export", "delete"]),
  ids: z.array(z.string().trim().min(1)).min(1, "Cần chọn ít nhất một báo giá"),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]).optional()
}).superRefine((value, ctx) => {
  if (value.action === "status" && !value.status) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "Thiếu trạng thái mới"
    });
  }
});

export type BulkQuoteDto = z.infer<typeof bulkQuoteSchema>;
