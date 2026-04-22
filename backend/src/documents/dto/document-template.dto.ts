import { DocumentType } from "@prisma/client";
import { z } from "zod";

const localizedTextSchema = z.object({
  vi: z.string().default(""),
  viEn: z.string().optional()
});

const templateStyleSchema = z.object({
  fontSize: z.number().min(6).max(48).optional(),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  lineHeight: z.number().min(1).max(2.5).optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  verticalAlign: z.enum(["top", "center", "bottom"]).optional(),
  color: z.string().trim().min(1).optional(),
  backgroundColor: z.string().trim().min(1).optional(),
  borderColor: z.string().trim().min(1).optional(),
  borderWidth: z.number().min(0).max(3).optional(),
  borderRadius: z.number().min(0).max(12).optional(),
  padding: z.number().min(0).max(12).optional()
});

const boxBaseSchema = z.object({
  id: z.string().trim().min(1),
  page: z.number().int().min(0),
  x: z.number().min(0).max(210),
  y: z.number().min(0).max(297),
  width: z.number().positive().max(210),
  height: z.number().positive().max(297),
  zIndex: z.number().int().min(0).max(999),
  visible: z.boolean().optional(),
  style: templateStyleSchema.optional()
});

const textBoxSchema = boxBaseSchema.extend({
  type: z.literal("text"),
  content: z.object({
    text: localizedTextSchema
  })
});

const imageBoxSchema = boxBaseSchema.extend({
  type: z.literal("image"),
  content: z.object({
    src: z.string().trim().min(1),
    alt: z.string().optional(),
    fit: z.enum(["contain", "cover"]).optional()
  })
});

const keyValueTableBoxSchema = boxBaseSchema.extend({
  type: z.literal("key_value_table"),
  content: z.object({
    labelWidth: z.number().min(10).max(80).optional(),
    rows: z.array(
      z.object({
        id: z.string().trim().min(1),
        label: localizedTextSchema,
        value: z.string().trim().min(1)
      })
    )
  })
});

const lineItemsTableBoxSchema = boxBaseSchema.extend({
  type: z.literal("line_items_table"),
  content: z.object({
    source: z.string().trim().min(1),
    columns: z.array(
      z.object({
        id: z.string().trim().min(1),
        label: localizedTextSchema,
        value: z.string().trim().min(1),
        width: z.number().positive().max(150).optional(),
        align: z.enum(["left", "center", "right"]).optional()
      })
    ),
    emptyText: localizedTextSchema.optional()
  })
});

const signatureBlockBoxSchema = boxBaseSchema.extend({
  type: z.literal("signature_block"),
  content: z.object({
    leftTitle: localizedTextSchema,
    rightTitle: localizedTextSchema,
    leftCaption: localizedTextSchema.optional(),
    rightCaption: localizedTextSchema.optional()
  })
});

export const documentTemplateLayoutSchema = z.object({
  version: z.literal(1),
  page: z.object({
    widthMm: z.number().min(100).max(220),
    heightMm: z.number().min(100).max(320),
    gridMm: z.number().min(1).max(20),
    marginMm: z.object({
      top: z.number().min(0).max(40),
      right: z.number().min(0).max(40),
      bottom: z.number().min(0).max(40),
      left: z.number().min(0).max(40)
    })
  }),
  pages: z.array(
    z.object({
      id: z.string().trim().min(1),
      boxes: z.array(
        z.discriminatedUnion("type", [
          textBoxSchema,
          imageBoxSchema,
          keyValueTableBoxSchema,
          lineItemsTableBoxSchema,
          signatureBlockBoxSchema
        ])
      )
    })
  ).min(1)
});

export const documentTemplateQuerySchema = z.object({
  type: z.nativeEnum(DocumentType).optional()
});

export const runtimeDocumentTemplateQuerySchema = z.object({
  type: z.nativeEnum(DocumentType)
});

export const createDocumentTemplateSchema = z.object({
  type: z.nativeEnum(DocumentType),
  name: z.string().trim().min(1, "Tên variant là bắt buộc").max(120),
  basedOnVariantId: z.string().trim().optional()
});

export const updateDocumentTemplateVariantSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  layoutJson: documentTemplateLayoutSchema.optional()
});

export const duplicateDocumentTemplateVariantSchema = z.object({
  name: z.string().trim().min(1, "Tên bản sao là bắt buộc").max(120).optional()
});

export type DocumentTemplateQueryDto = z.infer<typeof documentTemplateQuerySchema>;
export type RuntimeDocumentTemplateQueryDto = z.infer<typeof runtimeDocumentTemplateQuerySchema>;
export type CreateDocumentTemplateDto = z.infer<typeof createDocumentTemplateSchema>;
export type UpdateDocumentTemplateVariantDto = z.infer<typeof updateDocumentTemplateVariantSchema>;
export type DuplicateDocumentTemplateVariantDto = z.infer<typeof duplicateDocumentTemplateVariantSchema>;
