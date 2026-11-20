import { Module } from "@nestjs/common";
import { InventoryReportsController } from "./inventory-reports.controller";
import { InventoryReportsService } from "./inventory-reports.service";
import { ReceiptReportsService } from "./receipt-reports.service";

@Module({
  controllers: [InventoryReportsController],
  providers: [InventoryReportsService, ReceiptReportsService]
})
export class InventoryReportsModule {}
