import { z } from "zod";

const avatarUrlSchema = z.string().trim().refine((value) => {
  if (value.startsWith("/uploads/avatars/") && !value.includes("..")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, "Avatar URL không hợp lệ");

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100, "Tên quá dài").optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    roleId: z.string().optional(), // Foreign key to UserRole table
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
