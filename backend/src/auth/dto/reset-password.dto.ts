import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Token khôi phục là bắt buộc"),
    password: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
      .max(128, "Mật khẩu quá dài"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirmPassword"]
  });

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
