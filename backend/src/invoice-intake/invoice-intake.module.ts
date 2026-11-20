import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { InvoiceIntakeController } from "./invoice-intake.controller";
import { InvoiceIntakeService } from "./invoice-intake.service";
import { MaterialMatchingService } from "./material-matching.service";
import { PendingLinesService } from "./pending-lines.service";

@Module({
  imports: [AuditModule],
  controllers: [InvoiceIntakeController],
  providers: [InvoiceIntakeService, MaterialMatchingService, PendingLinesService],
  exports: [MaterialMatchingService]
})
export class InvoiceIntakeModule {}
