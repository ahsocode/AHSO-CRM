import { createStockTransferSchema } from "./create-stock-transfer.dto";
import type { CreateStockTransferDto } from "./create-stock-transfer.dto";

export const updateStockTransferSchema = createStockTransferSchema;

export type UpdateStockTransferDto = CreateStockTransferDto;
