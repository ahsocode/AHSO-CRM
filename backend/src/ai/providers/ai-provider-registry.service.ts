import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { AnthropicProvider } from "./anthropic.provider";
import { GeminiProvider } from "./gemini.provider";
import { OpenAiProvider } from "./openai.provider";
import { AiAuthMode, AiGenerationResult, AiProviderName, AiProviderStatus, AiTextProvider, AiTextRequest } from "./ai-provider.types";

@Injectable()
export class AiProviderRegistry {
  private readonly logger = new Logger(AiProviderRegistry.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiCredentialsService: AiCredentialsService,
    private readonly anthropicProvider: AnthropicProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly geminiProvider: GeminiProvider
  ) {}

  async generateText(request: AiTextRequest) {
    return (await this.generateTextResult(request))?.text ?? null;
  }

  async generateTextResult(request: AiTextRequest, providerName?: AiProviderName | null): Promise<AiGenerationResult | null> {
    const provider = this.resolveProvider(providerName);
    if (!provider) {
      return null;
    }

    const startedAt = Date.now();
    try {
      const text = await this.generateWithRetry(provider, request);
      const normalizedText = text.trim();
      if (!normalizedText) {
        return null;
      }

      return {
        text: normalizedText,
        provider: provider.name,
        model: request.model?.trim() || this.getProviderModel(provider),
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      this.logger.warn(`AI provider ${provider.name} lỗi: ${error instanceof Error ? error.message : "unknown"}`);
      throw new ServiceUnavailableException(this.toUserFacingError(provider.name, error));
    }
  }

  async getStatus(): Promise<AiProviderStatus[]> {
    const storedCredentials = await this.aiCredentialsService.listStatus();

    return this.providers().map((provider) => {
      const credential = storedCredentials.find((item) => item.provider === provider.name);
      const envConfigured = provider.isConfigured();
      const credentialActive = credential?.status === "ACTIVE";

      return {
        provider: provider.name,
        configured: credentialActive || envConfigured,
        model: credential?.modelOverride ?? this.getProviderModel(provider),
        authMode: this.normalizeAuthMode(credential?.authMode) ?? this.getProviderAuthMode(provider),
        status: this.normalizeStatus(credential?.status) ?? (envConfigured ? "ACTIVE" : "UNCONFIGURED"),
        lastError: credential?.lastError ?? null,
        expiresAt: credential?.expiresAt ?? null,
        hasRefreshToken: credential?.hasRefreshToken ?? false,
        source: credential ? "database" : envConfigured ? "env" : "none"
      } satisfies AiProviderStatus;
    });
  }

  async testProvider(providerName: AiProviderName, prompt?: string) {
    const provider = this.providers().find((candidate) => candidate.name === providerName);
    if (!provider) {
      throw new ServiceUnavailableException("AI provider không hợp lệ");
    }

    const startedAt = Date.now();
    const text = await this.generateWithRetry(provider, {
      system: "Bạn là trợ lý kiểm tra kết nối AI cho AHSO CRM. Trả lời ngắn gọn bằng tiếng Việt.",
      prompt: prompt?.trim() || "Hãy trả lời đúng một câu: Kết nối AI hoạt động.",
      maxTokens: 80,
      temperature: 0
    });

    return {
      success: Boolean(text.trim()),
      provider: provider.name,
      model: this.getProviderModel(provider),
      durationMs: Date.now() - startedAt,
      message: text.trim() || "Provider trả về phản hồi rỗng"
    };
  }

  getActiveProviderName() {
    return this.resolveProvider()?.name ?? null;
  }

  private resolveProvider(providerName?: AiProviderName | null) {
    const configuredName = providerName ?? (this.configService.get<string>("AI_PROVIDER") ?? "anthropic") as AiProviderName;
    const provider = this.providers().find((candidate) => candidate.name === configuredName);

    if (provider) {
      return provider;
    }

    return this.anthropicProvider;
  }

  private providers(): AiTextProvider[] {
    return [this.anthropicProvider, this.openAiProvider, this.geminiProvider];
  }

  private getProviderModel(provider: AiTextProvider) {
    if (provider instanceof AnthropicProvider || provider instanceof OpenAiProvider || provider instanceof GeminiProvider) {
      return provider.getModel();
    }

    return "unknown";
  }

  private getProviderAuthMode(provider: AiTextProvider) {
    if (provider instanceof AnthropicProvider || provider instanceof OpenAiProvider || provider instanceof GeminiProvider) {
      return provider.getAuthMode();
    }

    return "api_key";
  }

  private normalizeAuthMode(value?: string | null): AiAuthMode | null {
    return value === "oauth" || value === "api_key" ? value : null;
  }

  private normalizeStatus(value?: string | null): AiProviderStatus["status"] | null {
    return value === "ACTIVE" || value === "ERROR" || value === "DISABLED" ? value : null;
  }

  private async generateWithRetry(provider: AiTextProvider, request: AiTextRequest) {
    try {
      return await provider.generateText(request);
    } catch (error) {
      if (!this.isRetryable(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
      return await provider.generateText(request);
    }
  }

  private isRetryable(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /AbortError|timeout|429| 5\d\d|lỗi 5\d\d/i.test(message);
  }

  private toUserFacingError(provider: AiProviderName, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/API[_\s-]?KEY|OAUTH|UNAUTHENTICATED|PERMISSION_DENIED|chưa được cấu hình|401|403/i.test(message)) {
      return `AI provider ${provider} chưa được cấu hình hợp lệ. Vui lòng kiểm tra credential trong Admin.`;
    }
    if (/429/i.test(message)) {
      return `AI provider ${provider} đang giới hạn tần suất. Vui lòng thử lại sau.`;
    }
    if (/AbortError|timeout/i.test(message)) {
      return `AI provider ${provider} phản hồi quá lâu. Vui lòng thử lại.`;
    }
    return `AI provider ${provider} tạm thời không khả dụng.`;
  }
}
