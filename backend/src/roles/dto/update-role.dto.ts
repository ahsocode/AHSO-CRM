import { z } from "zod";

export const UpdateRoleSchema = z.object({
  name: z.string().min(1, "Tên role không được để trống").max(100).optional(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string()).optional(),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
