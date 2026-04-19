import { z } from "zod";

export const UpdateRoleSchema = z.object({
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string()).optional(),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
