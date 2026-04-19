import { z } from "zod";

// Company settings schema
export const CompanySettingSchema = z.object({
  name: z.string().min(1, "Tên công ty không được để trống").max(255),
  shortName: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

export type CompanySettingInput = z.infer<typeof CompanySettingSchema>;

// Policy settings schema
export const PolicySettingSchema = z.object({
  paymentTerms: z.string().max(500, "Điều khoản thanh toán không được vượt quá 500 ký tự").optional(),
  taxTypes: z.string().max(500, "Thông tin thuế không được vượt quá 500 ký tự").optional(),
  warranty: z.string().max(500, "Chính sách bảo hành không được vượt quá 500 ký tự").optional(),
  service: z.string().max(500, "Chính sách dịch vụ không được vượt quá 500 ký tự").optional(),
});

export type PolicySettingInput = z.infer<typeof PolicySettingSchema>;

// Generic update setting DTO
export class UpdateSettingDto {
  value!: string; // JSON-stringified
}
