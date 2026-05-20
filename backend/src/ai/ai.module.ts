import { forwardRef, Module } from "@nestjs/common";
import { AiCredentialsModule } from "../ai-credentials/ai-credentials.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiProviderRegistry } from "./providers/ai-provider-registry.service";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { GeminiProvider } from "./providers/gemini.provider";
import { OpenAiProvider } from "./providers/openai.provider";

@Module({
  imports: [forwardRef(() => AiCredentialsModule)],
  controllers: [AiController],
  providers: [AiService, AiProviderRegistry, AnthropicProvider, OpenAiProvider, GeminiProvider],
  exports: [AiService, AiProviderRegistry]
})
export class AiModule {}
