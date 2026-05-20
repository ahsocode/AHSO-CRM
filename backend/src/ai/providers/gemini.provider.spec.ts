import { ConfigService } from "@nestjs/config";
import { AiCredentialsService } from "../../ai-credentials/ai-credentials.service";
import { GeminiProvider } from "./gemini.provider";

describe("GeminiProvider", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("calls Gemini generateContent API with API key query", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Xin chào Gemini" }]
            }
          }
        ]
      })
    });

    const provider = new GeminiProvider(createConfig({
      AI_AUTH_MODE: "api_key",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-1.5-flash",
      GEMINI_BASE_URL: "https://generativelanguage.googleapis.com",
      AI_REQUEST_TIMEOUT_MS: 5000
    }), createCredentials());

    await expect(provider.generateText({
      system: "system prompt",
      prompt: "user prompt",
      maxTokens: 123,
      temperature: 0.2
    })).resolves.toBe("Xin chào Gemini");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=gemini-key",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"maxOutputTokens\":123")
      })
    );
  });

  it("uses provider-specific OAuth token and does not append key query", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "OAuth Gemini" }] } }]
      })
    });

    const provider = new GeminiProvider(createConfig({
      AI_AUTH_MODE: "oauth",
      AI_OAUTH_ACCESS_TOKEN: "shared-token",
      GEMINI_OAUTH_ACCESS_TOKEN: "gemini-token",
      GEMINI_BASE_URL: "https://gemini.example.test"
    }), createCredentials());

    await provider.generateText({
      system: "system",
      prompt: "prompt",
      maxTokens: 10,
      temperature: 0
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gemini.example.test/v1beta/models/gemini-1.5-flash:generateContent",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer gemini-token"
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
