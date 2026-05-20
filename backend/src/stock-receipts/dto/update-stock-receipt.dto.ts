import { createStockReceiptSchema } from "./create-stock-receipt.dto";
import type { CreateStockReceiptDto } from "./create-stock-receipt.dto";

export const updateStockReceiptSchema = createStockReceiptSchema;

export type UpdateStockReceiptDto = CreateStockReceiptDto;
