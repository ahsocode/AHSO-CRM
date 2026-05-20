import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { decrypt, encrypt } from "../common/utils/crypto.util";
import { AiCredentialsService } from "./ai-credentials.service";

interface PrismaMock {
  aiProviderCredential: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  aiOAuthState: {
    create: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

const ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";

describe("AiCredentialsService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("creates an OAuth authorize URL without exposing raw state", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma, {
      NODE_ENV: "production",
      FRONTEND_URL: "https://crm.ahso.vn",
      GEMINI_OAUTH_AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
      GEMINI_OAUTH_CLIENT_ID: "gemini-client",
      GEMINI_OAUTH_SCOPES: "scope-a scope-b"
    });

    const result = await service.createAuthorizeUrl(
      "gemini",
      "https://crm.ahso.vn/admin/ai-providers/callback",
      "user-1"
    );

    expect("state" in result).toBe(false);
    expect(result.authorizeUrl).toContain("client_id=gemini-client");
    expect(result.authorizeUrl).toContain("redirect_uri=https%3A%2F%2Fcrm.ahso.vn%2Fadmin%2Fai-providers%2Fcallback");
    expect(prisma.aiOAuthState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "gemini",
        redirectUri: "https://crm.ahso.vn/admin/ai-providers/callback",
        createdById: "user-1"
      })
    });
  });

  it("rejects OAuth redirect URIs outside the configured allowlist", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma, {
      NODE_ENV: "production",
      FRONTEND_URL: "https://crm.ahso.vn",
      OPENAI_OAUTH_AUTH_URL: "https://auth.openai.test/oauth",
      OPENAI_OAUTH_CLIENT_ID: "openai-client"
    });

    await expect(service.createAuthorizeUrl(
      "openai",
      "https://evil.test/oauth/callback",
      "user-1"
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiOAuthState.create).not.toHaveBeenCalled();
  });

  it("allows exact OAuth redirect URIs from AI_OAUTH_REDIRECT_URI_ALLOWLIST", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma, {
      NODE_ENV: "production",
      FRONTEND_URL: "https://crm.ahso.vn",
      AI_OAUTH_REDIRECT_URI_ALLOWLIST: "https://api.ahso.vn/api/ai-credentials/oauth/callback",
      OPENAI_OAUTH_AUTH_URL: "https://auth.openai.test/oauth",
      OPENAI_OAUTH_CLIENT_ID: "openai-client"
    });

    await service.createAuthorizeUrl(
      "openai",
      "https://api.ahso.vn/api/ai-credentials/oauth/callback",
      "user-1"
    );

    expect(prisma.aiOAuthState.create).toHaveBeenCalled();
  });

  it("consumes OAuth state before exchanging the authorization code", async () => {
    const prisma = createPrismaMock();
    const expiresAt = new Date(Date.now() + 60_000);
    prisma.aiOAuthState.findUnique.mockResolvedValue({
      id: "state-row-1",
      state: "state-token",
      provider: "openai",
      redirectUri: "https://crm.ahso.vn/oauth/ai/callback",
      createdById: "user-1",
      expiresAt,
      consumedAt: null,
      createdAt: new Date()
    });
    prisma.aiOAuthState.updateMany.mockResolvedValue({ count: 1 });
    prisma.aiProviderCredential.upsert.mockImplementation(async ({ create }) => ({
      ...create,
      id: "credential-1",
      expiresAt: new Date(Date.now() + 3600_000),
      connectedById: "user-1",
      lastError: null,
      updatedAt: new Date()
    }));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "scope-a scope-b"
      })
    });

    const service = createService(prisma, {
      OPENAI_OAUTH_TOKEN_URL: "https://auth.openai.test/token",
      OPENAI_OAUTH_CLIENT_ID: "openai-client",
      OPENAI_OAUTH_CLIENT_SECRET: "openai-secret",
      AI_REQUEST_TIMEOUT_MS: 5000
    });

    await service.handleOAuthCallback("state-token", "code-1");

    expect(prisma.aiOAuthState.updateMany).toHaveBeenCalledWith({
      where: {
        id: "state-row-1",
        consumedAt: null
      },
      data: {
        consumedAt: expect.any(Date)
      }
    });
    expect(prisma.aiOAuthState.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.openai.test/token",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("does not exchange code when OAuth state was already consumed concurrently", async () => {
    const prisma = createPrismaMock();
    prisma.aiOAuthState.findUnique.mockResolvedValue({
      id: "state-row-1",
      state: "state-token",
      provider: "openai",
      redirectUri: "https://crm.ahso.vn/oauth/ai/callback",
      createdById: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      createdAt: new Date()
    });
    prisma.aiOAuthState.updateMany.mockResolvedValue({ count: 0 });
    const service = createService(prisma, {});

    await expect(service.handleOAuthCallback("state-token", "code-1"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serializes concurrent OAuth refreshes for the same provider", async () => {
    const prisma = createPrismaMock();
    const expiredCredential = {
      id: "credential-1",
      provider: "gemini",
      authMode: "oauth",
      accessToken: encrypt("old-access-token"),
      refreshToken: encrypt("old-refresh-token"),
      tokenType: "Bearer",
      scopes: [],
      expiresAt: new Date(Date.now() - 1000),
      status: "ACTIVE",
      connectedById: "user-1",
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    prisma.aiProviderCredential.findUnique.mockResolvedValue(expiredCredential);
    prisma.aiProviderCredential.update.mockResolvedValue({
      ...expiredCredential,
      accessToken: encrypt("new-access-token")
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        token_type: "Bearer",
        expires_in: 3600
      })
    });
    const service = createService(prisma, {
      GEMINI_OAUTH_TOKEN_URL: "https://oauth2.googleapis.com/token",
      GEMINI_OAUTH_CLIENT_ID: "gemini-client",
      GEMINI_OAUTH_CLIENT_SECRET: "gemini-secret",
      AI_REQUEST_TIMEOUT_MS: 5000
    });

    await expect(Promise.all([
      service.getCredentialAccessToken("gemini"),
      service.getCredentialAccessToken("gemini")
    ])).resolves.toEqual(["new-access-token", "new-access-token"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.aiProviderCredential.update).toHaveBeenCalledTimes(1);
    const updatePayload = prisma.aiProviderCredential.update.mock.calls[0]?.[0];
    expect(decrypt(updatePayload.data.accessToken)).toBe("new-access-token");
    expect(decrypt(updatePayload.data.refreshToken)).toBe("new-refresh-token");
  });
});

function createPrismaMock(): PrismaMock {
  const aiProviderCredential = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };
  const aiOAuthState = {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn()
  };

  return {
    aiProviderCredential,
    aiOAuthState,
    $transaction: jest.fn(async (
      callback: (tx: Pick<PrismaMock, "aiProviderCredential" | "aiOAuthState">) => Promise<unknown>
    ) => callback({ aiProviderCredential, aiOAuthState }))
  };
}

function createService(prisma: PrismaMock, config: Record<string, string | number>) {
  const configService = {
    get: jest.fn((key: string) => config[key])
  } as Partial<ConfigService> as ConfigService;

  return new AiCredentialsService(prisma as never as PrismaService, configService);
}
