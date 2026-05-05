import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { EmailModule } from "../email/email.module";
import { SettingsModule } from "../settings/settings.module";
import { UploadModule } from "../upload/upload.module";
import { QuotesController } from "./quotes.controller";
import { QuotesPdfService } from "./quotes-pdf.service";
import { QuotesService } from "./quotes.service";

@Module({
  imports: [SettingsModule, UploadModule, EmailModule, DomainEventsModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuotesPdfService]
})
export class QuotesModule {}
