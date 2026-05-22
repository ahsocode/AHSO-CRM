import { Module } from "@nestjs/common";
import { CustomFieldsModule } from "../custom-fields/custom-fields.module";
import { DocumentsModule } from "../documents/documents.module";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { EmailModule } from "../email/email.module";
import { SettingsModule } from "../settings/settings.module";
import { UploadModule } from "../upload/upload.module";
import { ContractsController } from "./contracts.controller";
import { ContractsPdfService } from "./contracts-pdf.service";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [SettingsModule, UploadModule, EmailModule, DomainEventsModule, CustomFieldsModule, DocumentsModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractsPdfService]
})
export class ContractsModule {}
