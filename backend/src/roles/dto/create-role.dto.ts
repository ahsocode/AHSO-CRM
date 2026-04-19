import { z } from "zod";

export const CreateRoleSchema = z.object({
  name: z.string().min(1, "Tên role không được để trống").max(100),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
