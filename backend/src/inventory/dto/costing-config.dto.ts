import { z } from "zod";

export const setCostingConfigSchema = z.object({
  method: z.enum(["AVERAGE", "FIFO"], { errorMap: () => ({ message: "Phương pháp phải là AVERAGE hoặc FIFO" }) }),
  effectiveFrom: z.coerce.date({ errorMap: () => ({ message: "Ngày hiệu lực không hợp lệ" }) }),
  reason: z.string({ required_error: "Lý do là bắt buộc" }).trim().min(5, "Lý do tối thiểu 5 ký tự").max(500),
});

export type SetCostingConfigDto = z.infer<typeof setCostingConfigSchema>;
