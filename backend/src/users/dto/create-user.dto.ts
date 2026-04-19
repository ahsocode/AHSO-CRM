import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  name: z.string().trim().min(1, "Tên người dùng không được để trống").max(120),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").max(100),
  roleId: z.string().trim().min(1, "Vai trò không được để trống"),
  avatarUrl: z.string().trim().url("Avatar URL không hợp lệ").optional(),
  isActive: z.boolean().optional()
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
