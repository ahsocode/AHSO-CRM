import { z } from "zod";
import { ROLE_VALUES } from "../../common/constants/role.constants";

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100, "Tên quá dài").optional(),
    avatarUrl: z.string().trim().url("Avatar URL không hợp lệ").nullable().optional(),
    role: z.enum(ROLE_VALUES).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần cung cấp ít nhất một trường để cập nhật"
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
