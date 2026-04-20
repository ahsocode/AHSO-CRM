import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SettingsModule } from "../settings/settings.module";
import { UploadModule } from "../upload/upload.module";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import { DocumentLayoutRendererService } from "./document-layout-renderer.service";
import { DocumentNumberService } from "./document-number.service";
import { DocumentTemplateVariantsService } from "./document-template-variants.service";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { I18nService } from "./i18n.service";
import { PdfRendererService } from "./pdf-renderer.service";

@Module({
  imports: [ConfigModule, SettingsModule, UploadModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentNumberService,
    DocumentDataLoaderService,
    DocumentTemplateVariantsService,
    DocumentLayoutRendererService,
    PdfRendererService,
    I18nService
  ],
  exports: [DocumentsService, DocumentNumberService, DocumentTemplateVariantsService]
})
export class DocumentsModule {}
