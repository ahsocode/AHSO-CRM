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

export const createCustomerSchema = z.object({
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
  status: z.enum(["LEAD", "PROSPECT", "ACTIVE", "INACTIVE"]).default("LEAD"),
  isVip: z.boolean().default(false),
  assignedToId: z.string().trim().min(1, "Người phụ trách là bắt buộc")
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

