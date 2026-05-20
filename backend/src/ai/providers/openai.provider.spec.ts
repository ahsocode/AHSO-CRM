import { ConfigService } from "@nestjs/config";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { OpenAiProvider } from "./openai.provider";

describe("OpenAiProvider", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("calls OpenAI-compatible chat completion API with API key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Xin chào"
            }
          }
        ]
      })
    });

    const provider = new OpenAiProvider(createConfig({
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "gpt-4o-mini",
      OPENAI_BASE_URL: "https://api.openai.com",
      AI_AUTH_MODE: "api_key",
      AI_REQUEST_TIMEOUT_MS: 5000
    }), createCredentials());

    await expect(provider.generateText({
      system: "system prompt",
      prompt: "user prompt",
      maxTokens: 123,
      temperature: 0.2
    })).resolves.toBe("Xin chào");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer openai-key"
        }),
        body: expect.stringContaining("\"model\":\"gpt-4o-mini\"")
      })
    );
  });

  it("uses provider-specific OAuth token before the shared token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OAuth OK" } }]
      })
    });

    const provider = new OpenAiProvider(createConfig({
      AI_AUTH_MODE: "oauth",
      AI_OAUTH_ACCESS_TOKEN: "shared-token",
      OPENAI_OAUTH_ACCESS_TOKEN: "openai-token",
      OPENAI_BASE_URL: "https://example.test"
    }), createCredentials());

    await provider.generateText({
      system: "system",
      prompt: "prompt",
      maxTokens: 10,
      temperature: 0
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer openai-token"
        })
      })
    );
  });
});

function createConfig(values: Record<string, string | number>) {
  return {
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

function createCredentials(token: string | null = null) {
  return {
    getCredentialAccessToken: jest.fn().mockResolvedValue(token),
    getCredentialModelOverride: jest.fn().mockResolvedValue(null)
  } as unknown as AiCredentialsService;
}
