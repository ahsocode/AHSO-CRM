import { z } from "zod";

export const createEmailAccountSchema = z.object({
  userId: z.string().trim().min(1, "Người dùng là bắt buộc"),
  email: z.string().trim().email("Email không hợp lệ"),
  imapHost: z.string().trim().min(1).default("mail.ahso.vn"),
  imapPort: z.coerce.number().int().min(1).max(65535).default(993),
  imapSecure: z.coerce.boolean().default(true),
  smtpHost: z.string().trim().min(1).default("mail.ahso.vn"),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587)
});

export type CreateEmailAccountDto = z.infer<typeof createEmailAccountSchema>;
