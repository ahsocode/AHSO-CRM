import { z } from "zod";
import { paginationSchema } from "../../common/dto/pagination.dto";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const coerceBoolean = z.preprocess((val) => {
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}, z.boolean().optional());

export const inventoryBalanceFilterSchema = paginationSchema.extend({
  warehouseId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  materialId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  lowStockOnly: coerceBoolean,
});

export type InventoryBalanceFilterDto = z.infer<typeof inventoryBalanceFilterSchema>;

export const warehouseFilterSchema = paginationSchema.extend({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  isActive: coerceBoolean,
});

export type WarehouseFilterDto = z.infer<typeof warehouseFilterSchema>;
