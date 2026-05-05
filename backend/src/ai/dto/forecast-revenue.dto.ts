import { z } from "zod";

export const forecastRevenueSchema = z.object({
  months: z.coerce.number().int().min(1, "Số tháng phải lớn hơn 0").max(12, "Chỉ hỗ trợ tối đa 12 tháng").default(3)
});

export type ForecastRevenueDto = z.infer<typeof forecastRevenueSchema>;
