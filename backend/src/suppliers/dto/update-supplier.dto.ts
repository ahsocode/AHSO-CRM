import { z } from "zod";

/**
 * Update semantics differ from create:
 * - field omitted (undefined) → keep current value
 * - empty string / null       → CLEAR the field (store null)
 *
 * Reusing createSupplierSchema.partial() made "" collapse to undefined, so a
 * user could never remove an old phone/email/address from a supplier.
 */
const emptyToNull = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const clearableString = (maxLength: number) =>
  z.preprocess(emptyToNull, z.string().max(maxLength).nullable().optional());

export const updateSupplierSchema = z.object({
  code: z.string().trim().min(1, "Mã nhà cung cấp là bắt buộc").max(40).optional(),
  name: z.string().trim().min(2, "Tên nhà cung cấp phải có ít nhất 2 ký tự").max(200).optional(),
  taxCode: clearableString(20),
  address: clearableString(500),
  phone: clearableString(30),
  email: z.preprocess(
    emptyToNull,
    z.string().email("Email không hợp lệ").nullable().optional()
  ),
  contactName: clearableString(100),
  notes: clearableString(2000),
  isActive: z.boolean().optional(),
});

export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
