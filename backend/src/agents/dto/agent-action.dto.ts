import { z } from "zod";

export const agentContextEntitySchema = z.object({
  entityType: z.enum(["customer"]),
  entityId: z.string().trim().min(1)
});

export const agentActionStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXECUTED",
  "FAILED"
]);

export const listAgentActionsSchema = z.object({
  contextEntityType: z.enum(["customer"]).optional(),
  contextEntityId: z.string().trim().min(1).optional(),
  status: agentActionStatusSchema.optional()
});

export const updateAgentActionPayloadSchema = z.object({
  finalPayload: z.record(z.unknown())
});

export const rejectAgentActionSchema = z.object({
  reviewNote: z.string().trim().max(1000).optional()
});

export type AgentContextEntityDto = z.infer<typeof agentContextEntitySchema>;
export type ListAgentActionsDto = z.infer<typeof listAgentActionsSchema>;
export type UpdateAgentActionPayloadDto = z.infer<typeof updateAgentActionPayloadSchema>;
export type RejectAgentActionDto = z.infer<typeof rejectAgentActionSchema>;
