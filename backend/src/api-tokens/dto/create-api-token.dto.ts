import { z } from "zod";
import { API_TOKEN_SCOPES } from "../api-token.constants";

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(2, "Tên token tối thiểu 2 ký tự").max(100),
  scopes: z
    .array(z.enum(API_TOKEN_SCOPES, { errorMap: () => ({ message: `Scope không hợp lệ. Cho phép: ${API_TOKEN_SCOPES.join(", ")}` }) }))
    .min(1, "Cần ít nhất một scope"),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .refine((value) => !value || new Date(value).getTime() > Date.now(), "Ngày hết hạn phải ở tương lai")
});

export type CreateApiTokenDto = z.infer<typeof createApiTokenSchema>;
