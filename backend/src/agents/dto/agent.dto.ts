import { z } from "zod";

export const agentToolSchema = z.enum([
  "search_customers",
  "get_customer_summary_context",
  "search_projects",
  "draft_sales_email"
]);

export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  systemPrompt: z.string().trim().min(10).max(5000),
  provider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  model: z.string().trim().max(100).optional(),
  enabledTools: z.array(agentToolSchema).default(["search_customers", "search_projects"]),
  isActive: z.boolean().default(true)
});

export const updateAgentSchema = createAgentSchema.partial();

export const runAgentSchema = z.object({
  input: z.string().trim().min(1).max(8000),
  context: z.record(z.string()).optional()
});

export type AgentTool = z.infer<typeof agentToolSchema>;
export type CreateAgentDto = z.infer<typeof createAgentSchema>;
export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;
export type RunAgentDto = z.infer<typeof runAgentSchema>;
