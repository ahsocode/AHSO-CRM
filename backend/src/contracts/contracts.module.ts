import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { UploadModule } from "../upload/upload.module";
import { ContractsController } from "./contracts.controller";
import { ContractsPdfService } from "./contracts-pdf.service";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [SettingsModule, UploadModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractsPdfService]
})
export class ContractsModule {}
