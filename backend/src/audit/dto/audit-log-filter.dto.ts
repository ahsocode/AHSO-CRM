import { z } from "zod";

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().positive().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  userId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  resource: z.string().trim().min(1).optional(),
  resourceId: z.string().trim().min(1).optional()
});

export type AuditLogFilterDto = z.infer<typeof auditLogFilterSchema>;

