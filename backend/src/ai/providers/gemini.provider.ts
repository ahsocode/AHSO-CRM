import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { AiAuthMode, AiProviderName, AiTextProvider, AiTextRequest } from "./ai-provider.types";
import { fetchWithTimeout, getAiRequestTimeoutMs } from "./http-ai.util";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

@Injectable()
export class GeminiProvider implements AiTextProvider {
  readonly name: AiProviderName = "gemini";

  constructor(
    private readonly configService: ConfigService,
    private readonly aiCredentialsService: AiCredentialsService
  ) {}

  isConfigured() {
    return Boolean(this.configService.get<string>("GEMINI_API_KEY"))
      || Boolean(this.configService.get<string>("GEMINI_OAUTH_ACCESS_TOKEN"))
      || Boolean(this.configService.get<string>("AI_OAUTH_ACCESS_TOKEN"));
  }

  getModel() {
    return this.configService.get<string>("GEMINI_MODEL") ?? "gemini-1.5-flash";
  }

  getAuthMode(): AiAuthMode {
    return this.configService.get<string>("AI_AUTH_MODE") === "oauth" ? "oauth" : "api_key";
  }

  async generateText(request: AiTextRequest) {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error("GEMINI_API_KEY hoặc AI_OAUTH_ACCESS_TOKEN chưa được cấu hình");
    }

    const baseUrl = this.configService.get<string>("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com";
    const modelPath = encodeURIComponent(await this.resolveModel());
    const apiKeyQuery = this.getAuthMode() === "api_key" ? `?key=${encodeURIComponent(accessToken)}` : "";
    const response = await fetchWithTimeout(
      `${baseUrl.replace(/\/+$/, "")}/v1beta/models/${modelPath}:generateContent${apiKeyQuery}`,
      {
        method: "POST",
        headers: {
          ...(this.getAuthMode() === "oauth" ? { Authorization: `Bearer ${accessToken}` } : {}),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: request.system }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: request.prompt }]
            }
          ],
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens
          }
        })
      },
      getAiRequestTimeoutMs(this.configService)
    );

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(`Gemini API lỗi ${response.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`);
    }

    const payload = await response.json() as GeminiResponse;
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
  }

  private async getAccessToken() {
    const storedToken = await this.aiCredentialsService.getCredentialAccessToken("gemini");
    if (storedToken) {
      return storedToken;
    }

    if (this.getAuthMode() === "oauth") {
      return this.configService.get<string>("GEMINI_OAUTH_ACCESS_TOKEN")
        ?? this.configService.get<string>("AI_OAUTH_ACCESS_TOKEN");
    }

    return this.configService.get<string>("GEMINI_API_KEY");
  }

  private async resolveModel() {
    return await this.aiCredentialsService.getCredentialModelOverride("gemini") ?? this.getModel();
  }
}
