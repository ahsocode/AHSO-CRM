import { z } from "zod";

const emailArray = z.array(z.string().trim().email("Email người nhận không hợp lệ")).min(1);

export const sendEmailSchema = z.object({
  to: emailArray,
  cc: z.array(z.string().trim().email("Email CC không hợp lệ")).default([]),
  bcc: z.array(z.string().trim().email("Email BCC không hợp lệ")).default([]),
  subject: z.string().trim().min(1, "Tiêu đề là bắt buộc").max(300),
  bodyHtml: z.string().min(1, "Nội dung email là bắt buộc"),
  bodyText: z.string().optional(),
  attachments: z.array(z.string().trim().min(1)).default([])
});

export type SendEmailDto = z.infer<typeof sendEmailSchema>;
