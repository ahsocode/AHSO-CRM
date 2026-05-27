import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const updateContactSchema = z
  .object({
    name: z.string().trim().min(2, "Tên liên hệ phải có ít nhất 2 ký tự").max(120).optional(),
    title: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
    department: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
    email: z.preprocess(
      emptyToUndefined,
      z.string().trim().email("Email liên hệ không hợp lệ").optional()
    ),
    phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
    isPrimary: z.boolean().optional(),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional())
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  });

export type UpdateContactDto = z.infer<typeof updateContactSchema>;

