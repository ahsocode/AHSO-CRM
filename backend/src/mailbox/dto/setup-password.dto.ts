import { z } from "zod";

export const setupPasswordSchema = z.object({
  password: z.string().min(8, "Mật khẩu email phải có ít nhất 8 ký tự")
});

export type SetupPasswordDto = z.infer<typeof setupPasswordSchema>;
