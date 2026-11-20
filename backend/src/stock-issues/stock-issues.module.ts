import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InventoryModule } from "../inventory/inventory.module";
import { StockIssuesController } from "./stock-issues.controller";
import { StockIssuesService } from "./stock-issues.service";

@Module({
  imports: [InventoryModule, AuditModule],
  controllers: [StockIssuesController],
  providers: [StockIssuesService],
})
export class StockIssuesModule {}
