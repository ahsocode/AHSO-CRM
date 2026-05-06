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

export const createUserSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  name: z.string().trim().min(1, "Tên người dùng không được để trống").max(120),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").max(100),
  roleId: z.string().trim().min(1, "Vai trò không được để trống"),
  avatarUrl: avatarUrlSchema.nullable().optional(),
  isActive: z.boolean().optional()
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
