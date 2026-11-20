import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CostingConfigController } from "./costing-config.controller";
import { CostingConfigService } from "./costing-config.service";
import { InventoryBalanceController } from "./inventory-balance.controller";
import { InventoryBalanceService } from "./inventory-balance.service";
import { WarehousesController } from "./warehouses.controller";
import { WarehousesService } from "./warehouses.service";

@Module({
  imports: [AuditModule],
  controllers: [WarehousesController, InventoryBalanceController, CostingConfigController],
  providers: [WarehousesService, InventoryBalanceService, CostingConfigService],
  exports: [InventoryBalanceService, CostingConfigService],
})
export class InventoryModule {}
