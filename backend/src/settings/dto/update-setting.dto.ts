import { z } from "zod";
import { normalizeWebsiteUrlInput } from "../../common/utils/url";

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nullableString = (max: number, message?: string) =>
  z.preprocess(emptyToNull, z.string().max(max, message).nullable().optional());

const nullableWebsite = z.preprocess((value) => {
  const normalized = normalizeWebsiteUrlInput(value);
  return normalized === undefined ? null : normalized;
}, z.string().url("Website không hợp lệ").nullable().optional());

// Company settings schema
export const CompanySettingSchema = z.object({
  name: z.string().min(1, "Tên công ty không được để trống").max(255),
  shortName: nullableString(50),
  taxId: nullableString(50),
  address: nullableString(500),
  phone: nullableString(20),
  email: z.preprocess(emptyToNull, z.string().email("Email không hợp lệ").nullable().optional()),
  website: nullableWebsite,
  // Representative — used as default signatory on generated documents.
  representative: nullableString(255),
  representativeTitle: nullableString(100),
  // Bank details — surfaced on quotations, invoices, payment requests.
  bankName: nullableString(255),
  bankBranch: nullableString(255),
  bankAccount: nullableString(100),
  bankAccountName: nullableString(255),
  swiftCode: nullableString(50),
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
