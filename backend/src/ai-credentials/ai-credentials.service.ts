import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma.service";
import { decrypt, encrypt } from "../common/utils/crypto.util";
import { fetchWithTimeout, getAiRequestTimeoutMs } from "../ai/providers/http-ai.util";
import { AiCredentialProvider, OAuthTokenResponse } from "./ai-credentials.types";

const REFRESH_SKEW_MS = 60_000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AiCredentialsService {
  private readonly refreshLocks = new Map<AiCredentialProvider, Promise<string | null>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async listStatus() {
    const credentials = await this.prisma.aiProviderCredential.findMany({
      orderBy: { provider: "asc" }
    });

    return credentials.map((credential) => ({
      provider: credential.provider,
      authMode: credential.authMode,
      status: credential.status,
      scopes: credential.scopes,
      expiresAt: credential.expiresAt,
      connectedById: credential.connectedById,
      lastError: credential.lastError,
      updatedAt: credential.updatedAt,
      modelOverride: credential.modelOverride,
      hasRefreshToken: Boolean(credential.refreshToken)
    }));
  }

  async upsertApiKey(provider: AiCredentialProvider, apiKey: string, userId: string, scopes: string[] = []) {
    const credential = await this.prisma.aiProviderCredential.upsert({
      where: { provider },
      update: {
        authMode: "api_key",
        accessToken: encrypt(apiKey),
        refreshToken: null,
        tokenType: null,
        scopes,
        expiresAt: null,
        status: "ACTIVE",
        connectedById: userId,
        lastError: null
      },
      create: {
        provider,
        authMode: "api_key",
        accessToken: encrypt(apiKey),
        scopes,
        status: "ACTIVE",
        connectedById: userId
      }
    });

    return this.toPublicCredential(credential);
  }

  async createAuthorizeUrl(provider: AiCredentialProvider, redirectUri: string, userId: string) {
    const authUrl = this.getRequiredConfig(this.key(provider, "OAUTH_AUTH_URL"));
    const clientId = this.getRequiredConfig(this.key(provider, "OAUTH_CLIENT_ID"));
    const scope = this.configService.get<string>(this.key(provider, "OAUTH_SCOPES")) ?? "";
    const safeRedirectUri = this.validateRedirectUri(redirectUri);
    const state = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await this.prisma.aiOAuthState.create({
      data: {
        state,
        provider,
        redirectUri: safeRedirectUri,
        createdById: userId,
        expiresAt
      }
    });

    const url = new URL(authUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", safeRedirectUri);
    url.searchParams.set("state", state);
    if (scope) {
      url.searchParams.set("scope", scope);
    }
    if (provider === "gemini") {
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
    }

    return {
      provider,
      authorizeUrl: url.toString(),
      expiresAt
    };
  }

  async handleOAuthCallback(state: string, code: string) {
    const oauthState = await this.prisma.aiOAuthState.findUnique({ where: { state } });
    if (!oauthState || oauthState.consumedAt || oauthState.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("OAuth state không hợp lệ hoặc đã hết hạn");
    }

    const provider = oauthState.provider as AiCredentialProvider;
    const consumed = await this.prisma.aiOAuthState.updateMany({
      where: {
        id: oauthState.id,
        consumedAt: null
      },
      data: { consumedAt: new Date() }
    });
    if (consumed.count !== 1) {
      throw new BadRequestException("OAuth state đã được sử dụng");
    }

    const token = await this.exchangeCode(provider, code, oauthState.redirectUri);
    if (!token.access_token) {
      throw new BadRequestException(token.error_description ?? token.error ?? "Không nhận được access token từ OAuth provider");
    }

    const credential = await this.prisma.$transaction(async (tx) => {
      return tx.aiProviderCredential.upsert({
        where: { provider },
        update: {
          authMode: "oauth",
          accessToken: encrypt(token.access_token ?? ""),
          refreshToken: token.refresh_token ? encrypt(token.refresh_token) : undefined,
          tokenType: token.token_type ?? "Bearer",
          scopes: this.parseScopes(token.scope),
          expiresAt: this.resolveExpiresAt(token.expires_in),
          status: "ACTIVE",
          connectedById: oauthState.createdById,
          lastError: null
        },
        create: {
          provider,
          authMode: "oauth",
          accessToken: encrypt(token.access_token ?? ""),
          refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null,
          tokenType: token.token_type ?? "Bearer",
          scopes: this.parseScopes(token.scope),
          expiresAt: this.resolveExpiresAt(token.expires_in),
          status: "ACTIVE",
          connectedById: oauthState.createdById
        }
      });
    });

    return this.toPublicCredential(credential);
  }

  async getCredentialAccessToken(provider: AiCredentialProvider) {
    const credential = await this.prisma.aiProviderCredential.findUnique({ where: { provider } });
    if (!credential || credential.status !== "ACTIVE" || !credential.accessToken) {
      return null;
    }

    if (credential.authMode === "api_key") {
      return decrypt(credential.accessToken);
    }

    const shouldRefresh = credential.expiresAt && credential.expiresAt.getTime() <= Date.now() + REFRESH_SKEW_MS;
    if (!shouldRefresh) {
      return decrypt(credential.accessToken);
    }

    return this.refreshCredentialWithLock(provider);
  }

  async getCredentialModelOverride(provider: AiCredentialProvider) {
    const credential = await this.prisma.aiProviderCredential.findUnique({
      where: { provider },
      select: { modelOverride: true }
    });

    return credential?.modelOverride ?? null;
  }

  async getCredentialAuthMode(provider: AiCredentialProvider) {
    const credential = await this.prisma.aiProviderCredential.findUnique({
      where: { provider },
      select: { authMode: true, status: true }
    });

    if (!credential || credential.status !== "ACTIVE") {
      return null;
    }

    return credential.authMode === "oauth" ? "oauth" : "api_key";
  }

  async disconnect(provider: AiCredentialProvider) {
    await this.prisma.aiProviderCredential.delete({ where: { provider } }).catch(() => {
      throw new NotFoundException("Chưa có credential để xóa");
    });

    return { success: true };
  }

  async updateModel(provider: AiCredentialProvider, model: string, userId: string) {
    const credential = await this.prisma.aiProviderCredential.upsert({
      where: { provider },
      update: {
        modelOverride: model,
        connectedById: userId,
        lastError: null
      },
      create: {
        provider,
        authMode: "api_key",
        modelOverride: model,
        scopes: [],
        status: "DISABLED",
        connectedById: userId
      }
    });

    return this.toPublicCredential(credential);
  }

  private refreshCredentialWithLock(provider: AiCredentialProvider) {
    const existingLock = this.refreshLocks.get(provider);
    if (existingLock) {
      return existingLock;
    }

    const refreshPromise = this.refreshExpiredCredential(provider).finally(() => {
      this.refreshLocks.delete(provider);
    });
    this.refreshLocks.set(provider, refreshPromise);

    return refreshPromise;
  }

  private async refreshExpiredCredential(provider: AiCredentialProvider) {
    const credential = await this.prisma.aiProviderCredential.findUnique({ where: { provider } });
    if (!credential || credential.status !== "ACTIVE" || !credential.accessToken) {
      return null;
    }

    if (credential.authMode === "api_key") {
      return decrypt(credential.accessToken);
    }

    const shouldRefresh = credential.expiresAt && credential.expiresAt.getTime() <= Date.now() + REFRESH_SKEW_MS;
    if (!shouldRefresh) {
      return decrypt(credential.accessToken);
    }

    if (!credential.refreshToken) {
      await this.prisma.aiProviderCredential.update({
        where: { provider },
        data: {
          status: "ERROR",
          lastError: "OAuth token đã hết hạn và không có refresh token"
        }
      });
      return null;
    }

    const refreshed = await this.refreshAccessToken(provider, decrypt(credential.refreshToken));
    if (!refreshed.access_token) {
      await this.prisma.aiProviderCredential.update({
        where: { provider },
        data: {
          status: "ERROR",
          lastError: refreshed.error_description ?? refreshed.error ?? "Không refresh được OAuth token"
        }
      });
      return null;
    }

    await this.prisma.aiProviderCredential.update({
      where: { provider },
      data: {
        accessToken: encrypt(refreshed.access_token),
        refreshToken: refreshed.refresh_token ? encrypt(refreshed.refresh_token) : credential.refreshToken,
        tokenType: refreshed.token_type ?? credential.tokenType,
        scopes: refreshed.scope ? this.parseScopes(refreshed.scope) : credential.scopes,
        expiresAt: this.resolveExpiresAt(refreshed.expires_in) ?? credential.expiresAt,
        status: "ACTIVE",
        lastError: null
      }
    });

    return refreshed.access_token;
  }

  private async exchangeCode(provider: AiCredentialProvider, code: string, redirectUri: string) {
    return this.postToken(provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    });
  }

  private async refreshAccessToken(provider: AiCredentialProvider, refreshToken: string) {
    return this.postToken(provider, {
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
  }

  private async postToken(provider: AiCredentialProvider, fields: Record<string, string>) {
    const tokenUrl = this.getRequiredConfig(this.key(provider, "OAUTH_TOKEN_URL"));
    const clientId = this.getRequiredConfig(this.key(provider, "OAUTH_CLIENT_ID"));
    const clientSecret = this.getRequiredConfig(this.key(provider, "OAUTH_CLIENT_SECRET"));
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...fields
    });

    const response = await fetchWithTimeout(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }, getAiRequestTimeoutMs(this.configService));

    const payload = await response.json().catch(() => ({})) as OAuthTokenResponse;
    if (!response.ok && !payload.error) {
      return {
        error: `HTTP_${response.status}`,
        error_description: "OAuth token endpoint trả về lỗi"
      };
    }

    return payload;
  }

  private validateRedirectUri(redirectUri: string) {
    let parsedRedirectUri: URL;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch {
      throw new BadRequestException("OAuth redirect URI không hợp lệ");
    }

    const allowlist = this.getRedirectUriAllowlist();
    if (allowlist.some((allowedUri) => this.normalizeUrl(allowedUri) === this.normalizeUrl(parsedRedirectUri.toString()))) {
      return parsedRedirectUri.toString();
    }

    const isAllowedCallbackPath = parsedRedirectUri.pathname === "/admin/ai-providers/callback";
    const frontendUrl = this.configService.get<string>("FRONTEND_URL");
    if (frontendUrl) {
      const frontendOrigin = new URL(frontendUrl).origin;
      if (parsedRedirectUri.origin === frontendOrigin && isAllowedCallbackPath) {
        return parsedRedirectUri.toString();
      }
    }

    const isDevelopment = this.configService.get<string>("NODE_ENV") !== "production";
    if (
      isDevelopment &&
      isAllowedCallbackPath &&
      ["localhost", "127.0.0.1"].includes(parsedRedirectUri.hostname)
    ) {
      return parsedRedirectUri.toString();
    }

    throw new BadRequestException("OAuth redirect URI không nằm trong danh sách cho phép");
  }

  private getRedirectUriAllowlist() {
    const rawAllowlist = this.configService.get<string>("AI_OAUTH_REDIRECT_URI_ALLOWLIST") ?? "";

    return rawAllowlist
      .split(",")
      .map((uri) => uri.trim())
      .filter(Boolean);
  }

  private normalizeUrl(uri: string) {
    const parsed = new URL(uri);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new BadRequestException(`${key} chưa được cấu hình`);
    }

    return value;
  }

  private key(provider: AiCredentialProvider, suffix: string) {
    return `${provider.toUpperCase()}_${suffix}`;
  }

  private resolveExpiresAt(expiresIn?: number) {
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  }

  private parseScopes(scope?: string) {
    return scope?.split(/\s+/).filter(Boolean) ?? [];
  }

  private toPublicCredential(credential: {
    provider: string;
    authMode: string;
    status: string;
    scopes: string[];
    expiresAt: Date | null;
    connectedById: string | null;
    lastError: string | null;
    updatedAt: Date;
    modelOverride?: string | null;
    refreshToken?: string | null;
  }) {
    return {
      provider: credential.provider,
      authMode: credential.authMode,
      status: credential.status,
      scopes: credential.scopes,
      expiresAt: credential.expiresAt,
      connectedById: credential.connectedById,
      lastError: credential.lastError,
      updatedAt: credential.updatedAt,
      modelOverride: credential.modelOverride ?? null,
      hasRefreshToken: Boolean(credential.refreshToken)
    };
  }
}
