export type AiProviderName = "anthropic" | "openai" | "gemini";
export type AiAuthMode = "api_key" | "oauth";

export interface AiTextRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  model?: string | null;
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiGenerationResult {
  text: string;
  provider: AiProviderName;
  model: string;
  durationMs: number;
  usage?: AiUsage;
  finishReason?: string;
}

export interface AiTextProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  generateText(request: AiTextRequest): Promise<string>;
}

export interface AiProviderStatus {
  provider: AiProviderName;
  configured: boolean;
  model: string;
  authMode: AiAuthMode;
  status: "ACTIVE" | "ERROR" | "DISABLED" | "UNCONFIGURED";
  lastError: string | null;
  expiresAt: Date | null;
  hasRefreshToken: boolean;
  source: "database" | "env" | "none";
}
