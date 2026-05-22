import { z } from "zod";

export const createPolicyItemSchema = z.object({
  type: z.enum(["PAYMENT_TERMS", "DELIVERY_TERMS"]),
  name: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(2000),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0)
});

export const updatePolicyItemSchema = createPolicyItemSchema.partial().omit({ type: true });

export const reorderPolicyItemsSchema = z.object({
  ids: z.array(z.string()).min(1)
});

export type CreatePolicyItemDto = z.infer<typeof createPolicyItemSchema>;
export type UpdatePolicyItemDto = z.infer<typeof updatePolicyItemSchema>;
