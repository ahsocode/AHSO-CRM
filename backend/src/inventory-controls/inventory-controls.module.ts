import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PeriodLockController } from "./period-lock.controller";
import { PeriodLockService } from "./period-lock.service";

@Module({
  imports: [AuditModule],
  controllers: [PeriodLockController],
  providers: [PeriodLockService],
  exports: [PeriodLockService]
})
export class InventoryControlsModule {}
