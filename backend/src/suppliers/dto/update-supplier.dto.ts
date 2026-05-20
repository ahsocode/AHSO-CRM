import { z } from "zod";
import { createSupplierSchema } from "./create-supplier.dto";

export const updateSupplierSchema = createSupplierSchema.partial();

export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
