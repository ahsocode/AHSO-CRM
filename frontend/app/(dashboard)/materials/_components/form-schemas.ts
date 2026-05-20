import { z } from "zod";

export const materialFormSchema = z.object({
  code: z.string().trim().min(1, "Mã vật tư là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên vật tư phải có ít nhất 2 ký tự").max(200),
  unit: z.string().trim().min(1, "Đơn vị tính là bắt buộc").max(40),
  salePrice: z.coerce.number().min(0, "Giá bán không được âm").default(0),
  costPrice: z.coerce.number().min(0, "Giá nhập không được âm").default(0),
  minStock: z.coerce.number().min(0).optional(),
  categoryId: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type MaterialFormValues = z.infer<typeof materialFormSchema>;
