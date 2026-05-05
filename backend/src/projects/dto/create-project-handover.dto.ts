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

export const createProjectHandoverSchema = z.object({
  summary: optionalString(3000),
  customerRequirements: optionalString(3000),
  risks: optionalString(3000),
  decisions: optionalString(3000),
  openTasks: optionalString(3000),
  importantDocumentIds: z.array(z.string().trim().min(1)).default([]),
  fromUserId: optionalString(80),
  toUserId: optionalString(80)
});

export type CreateProjectHandoverDto = z.infer<typeof createProjectHandoverSchema>;
