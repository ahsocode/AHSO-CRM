import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CommonAllocationsService } from "./common-allocations.service";
import { CostRecognitionService } from "./cost-recognition.service";
import { ExpenseCostsService } from "./expense-costs.service";
import { ProjectFinanceController, SalesInvoicesController } from "./project-finance.controller";
import { SalesInvoicesService } from "./sales-invoices.service";

@Module({
  imports: [AuditModule],
  controllers: [SalesInvoicesController, ProjectFinanceController],
  providers: [SalesInvoicesService, CostRecognitionService, ExpenseCostsService, CommonAllocationsService]
})
export class ProjectFinanceModule {}
