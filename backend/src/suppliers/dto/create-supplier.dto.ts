import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

export const createSupplierSchema = z.object({
  code: z.string().trim().min(1, "Mã nhà cung cấp là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên nhà cung cấp phải có ít nhất 2 ký tự").max(200),
  taxCode: optionalString(20),
  address: optionalString(500),
  phone: optionalString(30),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Email không hợp lệ").optional()
  ),
  contactName: optionalString(100),
  notes: optionalString(2000),
  isActive: z.boolean().default(true),
});

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
