import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getMessagesSchema = z.object({
  folder: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()).default("INBOX"),
  search: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  customerId: z.preprocess(emptyToUndefined, z.string().trim().optional())
});

export type GetMessagesDto = z.infer<typeof getMessagesSchema>;
