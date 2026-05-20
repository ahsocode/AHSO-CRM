import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { StockIssuesController } from "./stock-issues.controller";
import { StockIssuesService } from "./stock-issues.service";

@Module({
  imports: [InventoryModule],
  controllers: [StockIssuesController],
  providers: [StockIssuesService],
})
export class StockIssuesModule {}
