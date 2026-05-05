import { Module } from "@nestjs/common";
import { UploadModule } from "../upload/upload.module";
import { SurveysController } from "./surveys.controller";
import { SurveysService } from "./surveys.service";

@Module({
  imports: [UploadModule],
  controllers: [SurveysController],
  providers: [SurveysService],
  exports: [SurveysService]
})
export class SurveysModule {}
