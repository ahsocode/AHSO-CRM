import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { BusinessDocumentsController } from "./business-documents.controller";
import { BusinessDocumentsService } from "./business-documents.service";

@Module({
  imports: [UploadModule],
  controllers: [BusinessDocumentsController],
  providers: [BusinessDocumentsService],
  exports: [BusinessDocumentsService]
})
export class BusinessDocumentsModule {}
