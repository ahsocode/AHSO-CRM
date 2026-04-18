import { z } from "zod";

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token là bắt buộc")
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

