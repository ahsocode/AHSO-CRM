import { Module } from "@nestjs/common";
import { BomsController } from "./boms.controller";
import { BomsService } from "./boms.service";
import { CostReportsService } from "./cost-reports.service";
import { ProjectCostsController } from "./project-costs.controller";
import { ProjectCostsService } from "./project-costs.service";

@Module({
  controllers: [BomsController, ProjectCostsController],
  providers: [BomsService, ProjectCostsService, CostReportsService]
})
export class BomsModule {}
