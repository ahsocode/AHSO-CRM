import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InventoryModule } from "../inventory/inventory.module";
import { StockReceiptsController } from "./stock-receipts.controller";
import { StockReceiptsService } from "./stock-receipts.service";

@Module({
  imports: [InventoryModule, AuditModule],
  controllers: [StockReceiptsController],
  providers: [StockReceiptsService],
})
export class StockReceiptsModule {}
