import { z } from "zod";
import { createMaterialSchema } from "./create-material.dto";

export const updateMaterialSchema = createMaterialSchema.partial();

export type UpdateMaterialDto = z.infer<typeof updateMaterialSchema>;
