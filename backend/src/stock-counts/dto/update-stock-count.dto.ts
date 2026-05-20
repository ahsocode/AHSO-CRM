import { createStockCountSchema } from "./create-stock-count.dto";
import type { CreateStockCountDto } from "./create-stock-count.dto";

export const updateStockCountSchema = createStockCountSchema;

export type UpdateStockCountDto = CreateStockCountDto;
