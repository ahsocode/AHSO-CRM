import { z } from "zod";

/**
 * `extra` is merged into the render context of an OFFICIAL, stored PDF. It used to accept any key,
 * so a caller with `documents.create` could replace company name/bank account, logo URL (fetched by
 * WeasyPrint: SSRF), policies, signer identity or the document number (audit E-07).
 * Only the keys below may be supplied; anything else is rejected with 400.
 */
export const RENDER_EXTRA_ALLOWED_KEYS = ["signedCopies"] as const;

export const renderExtraSchema = z
  .object({
    /** Shows the "lập thành … bản" note in the legal footer partial. Display flag only. */
    signedCopies: z.boolean().optional()
  })
  .strict();

export type RenderExtraDto = z.infer<typeof renderExtraSchema>;

export const renderDocumentSchema = z.object({
  language: z.enum(["vi", "vi-en"]).optional(),
  templateVariantId: z.string().trim().min(1).optional(),
  extra: renderExtraSchema.optional()
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
