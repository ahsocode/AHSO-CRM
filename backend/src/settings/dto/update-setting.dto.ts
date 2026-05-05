import { z } from "zod";
import { normalizeWebsiteUrlInput } from "../../common/utils/url";

// Company settings schema
export const CompanySettingSchema = z.object({
  name: z.string().min(1, "Tên công ty không được để trống").max(255),
  shortName: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website: z.preprocess(normalizeWebsiteUrlInput, z.string().url("Website không hợp lệ").optional()),
  // Representative — used as default signatory on generated documents.
  representative: z.string().max(255).optional(),
  representativeTitle: z.string().max(100).optional(),
  // Bank details — surfaced on quotations, invoices, payment requests.
  bankName: z.string().max(255).optional(),
  bankBranch: z.string().max(255).optional(),
  bankAccount: z.string().max(100).optional(),
  bankAccountName: z.string().max(255).optional(),
  swift: z.string().max(50).optional(),
});

export type CompanySettingInput = z.infer<typeof CompanySettingSchema>;

// Policy settings schema
export const PolicySettingSchema = z.object({
  paymentTerms: z.string().max(500, "Điều khoản thanh toán không được vượt quá 500 ký tự").optional(),
  taxTypes: z.string().max(500, "Thông tin thuế không được vượt quá 500 ký tự").optional(),
  warranty: z.string().max(500, "Chính sách bảo hành không được vượt quá 500 ký tự").optional(),
  service: z.string().max(500, "Chính sách dịch vụ không được vượt quá 500 ký tự").optional(),
  // Document-template defaults.
  deliveryTerms: z.string().max(500, "Điều khoản giao hàng không được vượt quá 500 ký tự").optional(),
  warrantyPeriodMonths: z
    .number()
    .int()
    .min(0, "Thời gian bảo hành phải không âm")
    .max(240, "Thời gian bảo hành không được vượt quá 240 tháng")
    .optional(),
  paymentDeadlineDays: z
    .number()
    .int()
    .min(0, "Hạn thanh toán phải không âm")
    .max(365, "Hạn thanh toán không được vượt quá 365 ngày")
    .optional(),
  ndaDurationYears: z
    .number()
    .int()
    .min(0, "Thời hạn NDA phải không âm")
    .max(50, "Thời hạn NDA không được vượt quá 50 năm")
    .optional(),
});

export type PolicySettingInput = z.infer<typeof PolicySettingSchema>;

// Generic update setting DTO
export class UpdateSettingDto {
  value!: string; // JSON-stringified
}
