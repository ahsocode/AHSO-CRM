import { DocumentType } from "@prisma/client";
import { z } from "zod";

export const projectDocumentTypeSchema = z.nativeEnum(DocumentType);

export const updateProjectDocumentPlanSchema = z.object({
  requiredTypes: z.array(projectDocumentTypeSchema).max(32)
});

export const generateProjectDocumentPlanSchema = z.object({
  mode: z.enum(["missing", "all"]).default("missing")
});

export type UpdateProjectDocumentPlanDto = z.infer<typeof updateProjectDocumentPlanSchema>;
export type GenerateProjectDocumentPlanDto = z.infer<typeof generateProjectDocumentPlanSchema>;
