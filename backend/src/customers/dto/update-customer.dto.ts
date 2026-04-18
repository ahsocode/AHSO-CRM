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

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2, "Tên khách hàng phải có ít nhất 2 ký tự").max(160).optional(),
    shortName: optionalString(12),
    taxCode: optionalString(40),
    industry: optionalString(120),
    address: optionalString(255),
    website: optionalUrl,
    phone: optionalString(40),
    email: optionalEmail,
    source: optionalString(80),
    notes: optionalString(2000),
    status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE"]).optional(),
    isVip: z.boolean().optional(),
    assignedToId: z.string().trim().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  });

export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

