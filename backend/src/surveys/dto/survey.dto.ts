import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalString = (maxLength: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(maxLength).optional());

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "true";
  }

  return value;
}, z.boolean().optional());

export const surveyNoteTypeSchema = z.enum([
  "GENERAL",
  "TECHNICAL_REQUIREMENT",
  "COMMERCIAL_REQUIREMENT",
  "SITE_CONSTRAINT",
  "RISK",
  "DECISION",
  "OPEN_QUESTION"
]);

export const createSurveySchema = z.object({
  title: z.string().trim().min(2, "Tiêu đề khảo sát phải có ít nhất 2 ký tự").max(180),
  surveyedAt: optionalDate,
  location: optionalString(300),
  customerParticipants: optionalString(800),
  objectives: optionalString(2000),
  summary: optionalString(5000),
  nextStep: optionalString(2000),
  customerId: z.string().trim().min(1, "Khách hàng là bắt buộc"),
  projectId: optionalString(80)
});

export const updateSurveySchema = createSurveySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Cần có ít nhất một trường để cập nhật"
});

export const addSurveyNoteSchema = z.object({
  type: surveyNoteTypeSchema.default("GENERAL"),
  content: z.string().trim().min(2, "Nội dung ghi chú phải có ít nhất 2 ký tự").max(5000),
  isImportant: z.boolean().default(false)
});

export const uploadSurveyMediaSchema = z.object({
  caption: optionalString(500),
  area: optionalString(200),
  isImportant: optionalBoolean.default(false)
});

export const surveyListFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: optionalString(80),
  projectId: optionalString(80),
  search: optionalString(200),
  dateFrom: optionalDate,
  dateTo: optionalDate
});

export type CreateSurveyDto = z.infer<typeof createSurveySchema>;
export type UpdateSurveyDto = z.infer<typeof updateSurveySchema>;
export type AddSurveyNoteDto = z.infer<typeof addSurveyNoteSchema>;
export type UploadSurveyMediaDto = z.infer<typeof uploadSurveyMediaSchema>;
export type SurveyListFilterDto = z.infer<typeof surveyListFilterSchema>;
