import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { AiAuthMode, AiProviderName, AiTextProvider, AiTextRequest } from "./ai-provider.types";

@Injectable()
export class AnthropicProvider implements AiTextProvider {
  readonly name: AiProviderName = "anthropic";
  private client?: Anthropic;
  private clientKey?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly aiCredentialsService: AiCredentialsService
  ) {}

  isConfigured() {
    return Boolean(this.configService.get<string>("ANTHROPIC_API_KEY"));
  }

  getModel() {
    return this.configService.get<string>("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514";
  }

  getAuthMode(): AiAuthMode {
    return this.configService.get<string>("AI_AUTH_MODE") === "oauth" ? "oauth" : "api_key";
  }

  async generateText(request: AiTextRequest) {
    const apiKey = await this.aiCredentialsService.getCredentialAccessToken("anthropic")
      ?? this.configService.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY chưa được cấu hình");
    }

    const client = this.getClient(apiKey);
    const model = request.model?.trim() || await this.resolveModel();
    const response = await client.messages.create({
      model,
      system: request.system,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: [
        {
          role: "user",
          content: request.prompt
        }
      ]
    });

    return response.content
      .filter((item): item is Anthropic.TextBlock => item.type === "text")
      .map((item) => item.text.trim())
      .filter(Boolean)
      .join("\n");
  }

  private getClient(apiKey: string) {
    if (this.client && this.clientKey === apiKey) {
      return this.client;
    }

    this.clientKey = apiKey;
    this.client = new Anthropic({ apiKey });
    return this.client;
  }

  private async resolveModel() {
    return await this.aiCredentialsService.getCredentialModelOverride("anthropic") ?? this.getModel();
  }
}
