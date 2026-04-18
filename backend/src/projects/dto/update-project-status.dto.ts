import { z } from "zod";

export const updateProjectStatusSchema = z.object({
  status: z.enum(["SURVEY", "QUOTING", "NEGOTIATING", "WON", "LOST", "DELIVERING", "COMPLETED"])
});

export type UpdateProjectStatusDto = z.infer<typeof updateProjectStatusSchema>;
