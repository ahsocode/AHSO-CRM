import { z } from "zod";
import { createWarehouseSchema } from "./create-warehouse.dto";

export const updateWarehouseSchema = createWarehouseSchema.partial();

export type UpdateWarehouseDto = z.infer<typeof updateWarehouseSchema>;
