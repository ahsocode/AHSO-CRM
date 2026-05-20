import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { AiAuthMode, AiProviderName, AiTextProvider, AiTextRequest } from "./ai-provider.types";
import { fetchWithTimeout, getAiRequestTimeoutMs } from "./http-ai.util";

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

@Injectable()
export class OpenAiProvider implements AiTextProvider {
  readonly name: AiProviderName = "openai";

  constructor(
    private readonly configService: ConfigService,
    private readonly aiCredentialsService: AiCredentialsService
  ) {}

  isConfigured() {
    return Boolean(this.configService.get<string>("OPENAI_API_KEY"))
      || Boolean(this.configService.get<string>("OPENAI_OAUTH_ACCESS_TOKEN"))
      || Boolean(this.configService.get<string>("AI_OAUTH_ACCESS_TOKEN"));
  }

  getModel() {
    return this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";
  }

  getAuthMode(): AiAuthMode {
    return this.configService.get<string>("AI_AUTH_MODE") === "oauth" ? "oauth" : "api_key";
  }

  async generateText(request: AiTextRequest) {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("OPENAI_API_KEY hoặc AI_OAUTH_ACCESS_TOKEN chưa được cấu hình");
    }

    const baseUrl = this.configService.get<string>("OPENAI_BASE_URL") ?? "https://api.openai.com";
    const model = await this.resolveModel();
    const response = await fetchWithTimeout(
      `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt }
          ]
        })
      },
      getAiRequestTimeoutMs(this.configService)
    );

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(`OpenAI API lỗi ${response.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`);
    }

    const payload = await response.json() as OpenAiChatResponse;
    return payload.choices?.[0]?.message?.content?.trim() ?? "";
  }

  private async getAccessToken() {
    const storedToken = await this.aiCredentialsService.getCredentialAccessToken("openai");
    if (storedToken) {
      return storedToken;
    }

    if (this.getAuthMode() === "oauth") {
      return this.configService.get<string>("OPENAI_OAUTH_ACCESS_TOKEN")
        ?? this.configService.get<string>("AI_OAUTH_ACCESS_TOKEN");
    }

    return this.configService.get<string>("OPENAI_API_KEY");
  }

  private async resolveModel() {
    return await this.aiCredentialsService.getCredentialModelOverride("openai") ?? this.getModel();
  }
}
