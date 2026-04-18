import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ")
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
