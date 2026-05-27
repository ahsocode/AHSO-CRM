import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createContactSchema = z.object({
  name: z.string().trim().min(2, "Tên liên hệ phải có ít nhất 2 ký tự").max(120),
  title: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  department: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Email liên hệ không hợp lệ").optional()
  ),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  isPrimary: z.boolean().default(false),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional())
});

export type CreateContactDto = z.infer<typeof createContactSchema>;

