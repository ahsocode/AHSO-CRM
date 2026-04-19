import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url("Website không hợp lệ").optional()
);

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email("Email không hợp lệ").optional()
);

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, "Tên khách hàng phải có ít nhất 2 ký tự").max(160),
  shortName: optionalString(12),
  taxCode: optionalString(40),
  industry: optionalString(120),
  address: optionalString(255),
  website: optionalUrl,
  phone: optionalString(40),
  email: optionalEmail,
  source: optionalString(80),
  notes: optionalString(2000),
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE"]),
  language: z.enum(["vi", "vi-en"]),
  isVip: z.boolean(),
  assignedToId: z.string().trim().min(1, "Người phụ trách là bắt buộc")
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const defaultCustomerFormValues: CustomerFormValues = {
  name: "",
  shortName: "",
  taxCode: "",
  industry: "",
  address: "",
  website: "",
  phone: "",
  email: "",
  source: "",
  notes: "",
  status: "LEAD",
  language: "vi",
  isVip: false,
  assignedToId: ""
};

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Tên liên hệ phải có ít nhất 2 ký tự").max(120),
  title: optionalString(120),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Email liên hệ không hợp lệ").optional()
  ),
  phone: optionalString(40),
  isPrimary: z.boolean(),
  notes: optionalString(1000)
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const defaultContactFormValues: ContactFormValues = {
  name: "",
  title: "",
  email: "",
  phone: "",
  isPrimary: false,
  notes: ""
};
