import { z } from "zod";

export const surveyFormSchema = z.object({
  title: z.string().trim().min(2, "Tiêu đề phải có ít nhất 2 ký tự").max(180),
  surveyedAt: z.string().optional().or(z.literal("")),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  customerParticipants: z.string().trim().max(800).optional().or(z.literal("")),
  objectives: z.string().trim().max(2000).optional().or(z.literal("")),
  summary: z.string().trim().max(5000).optional().or(z.literal("")),
  nextStep: z.string().trim().max(2000).optional().or(z.literal("")),
  customerId: z.string().min(1, "Chọn khách hàng"),
  projectId: z.string().optional().or(z.literal("")),
});

export const surveyNoteFormSchema = z.object({
  type: z.enum([
    "GENERAL",
    "TECHNICAL_REQUIREMENT",
    "COMMERCIAL_REQUIREMENT",
    "SITE_CONSTRAINT",
    "RISK",
    "DECISION",
    "OPEN_QUESTION",
  ]),
  content: z.string().trim().min(2, "Nội dung phải có ít nhất 2 ký tự").max(5000),
  isImportant: z.boolean().default(false),
});

export type SurveyFormValues = z.infer<typeof surveyFormSchema>;
export type SurveyNoteFormValues = z.infer<typeof surveyNoteFormSchema>;
