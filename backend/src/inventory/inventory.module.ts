import { Module } from "@nestjs/common";
import { InventoryBalanceController } from "./inventory-balance.controller";
import { InventoryBalanceService } from "./inventory-balance.service";
import { WarehousesController } from "./warehouses.controller";
import { WarehousesService } from "./warehouses.service";

@Module({
  controllers: [WarehousesController, InventoryBalanceController],
  providers: [WarehousesService, InventoryBalanceService],
  exports: [InventoryBalanceService],
})
export class InventoryModule {}
