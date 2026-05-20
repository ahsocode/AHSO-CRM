import { ConfigService } from "@nestjs/config";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { AnthropicProvider } from "./anthropic.provider";
import { AiProviderRegistry } from "./ai-provider-registry.service";
import { GeminiProvider } from "./gemini.provider";
import { OpenAiProvider } from "./openai.provider";

describe("AiProviderRegistry", () => {
  it("prefers active database credential metadata over env provider status", async () => {
    const registry = new AiProviderRegistry(
      createConfig({ AI_PROVIDER: "openai" }),
      createCredentials([{
        provider: "openai",
        authMode: "oauth",
        status: "ACTIVE",
        scopes: [],
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        connectedById: "admin-1",
        lastError: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        modelOverride: "gpt-4.1",
        hasRefreshToken: true
      }]),
      new AnthropicProvider(createConfig({}), createCredentials([])),
      new OpenAiProvider(createConfig({
        OPENAI_API_KEY: "env-key",
        OPENAI_MODEL: "gpt-env"
      }), createCredentials([])),
      new GeminiProvider(createConfig({}), createCredentials([]))
    );

    await expect(registry.getStatus()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: "openai",
        configured: true,
        authMode: "oauth",
        model: "gpt-4.1",
        status: "ACTIVE",
        hasRefreshToken: true,
        source: "database"
      })
    ]));
  });
});

function createConfig(values: Record<string, string>) {
  return {
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

function createCredentials(status: Awaited<ReturnType<AiCredentialsService["listStatus"]>>) {
  return {
    listStatus: jest.fn().mockResolvedValue(status)
  } as unknown as AiCredentialsService;
}
