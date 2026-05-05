import { DocumentType as PrismaDocumentType } from "@prisma/client";

/**
 * Re-export Prisma DocumentType so the rest of the app does not have to
 * depend directly on @prisma/client when referencing document types.
 */
export const DocumentType = PrismaDocumentType;
export type DocumentType = PrismaDocumentType;

export const DOCUMENT_TYPES = Object.values(PrismaDocumentType) as PrismaDocumentType[];

export type DocumentLanguage = "vi" | "vi-en";
export const DOCUMENT_LANGUAGES: DocumentLanguage[] = ["vi", "vi-en"];

export type DocumentEntityType = "quote" | "contract" | "customer" | "project";
export const DOCUMENT_ENTITY_TYPES: DocumentEntityType[] = [
  "quote",
  "contract",
  "customer",
  "project"
];
