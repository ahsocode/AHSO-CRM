import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { UploadService } from "./upload.service";
import { UploadController } from "./upload.controller";

@Module({
  imports: [CommonModule],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService]
})
export class UploadModule {}
