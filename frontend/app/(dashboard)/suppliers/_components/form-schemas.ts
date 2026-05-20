import { z } from "zod";

export const supplierFormSchema = z.object({
  code: z.string().trim().min(1, "Mã NCC là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên NCC phải có ít nhất 2 ký tự").max(200),
  taxCode: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Email không hợp lệ").optional().or(z.literal("")),
  contactName: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
