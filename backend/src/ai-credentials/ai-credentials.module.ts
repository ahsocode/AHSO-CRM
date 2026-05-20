import { forwardRef, Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AiCredentialsController } from "./ai-credentials.controller";
import { AiCredentialsService } from "./ai-credentials.service";

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [AiCredentialsController],
  providers: [AiCredentialsService],
  exports: [AiCredentialsService]
})
export class AiCredentialsModule {}
