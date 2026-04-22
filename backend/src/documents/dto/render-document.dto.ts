import { z } from "zod";

export const renderDocumentSchema = z.object({
  language: z.enum(["vi", "vi-en"]).optional(),
  templateVariantId: z.string().trim().min(1).optional(),
  extra: z.record(z.unknown()).optional()
});

export type RenderDocumentDto = z.infer<typeof renderDocumentSchema>;

export const documentListFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  customerId: z.string().optional()
});

export type DocumentListFilterDto = z.infer<typeof documentListFilterSchema>;

export const previewQuerySchema = z.object({
  lang: z.enum(["vi", "vi-en"]).optional(),
  templateVariantId: z.string().trim().min(1).optional()
});

export type PreviewQueryDto = z.infer<typeof previewQuerySchema>;
