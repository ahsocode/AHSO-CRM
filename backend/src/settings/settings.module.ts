import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { CommonModule } from "src/common/common.module";
import { UploadModule } from "src/upload/upload.module";

@Module({
  imports: [CommonModule, UploadModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
