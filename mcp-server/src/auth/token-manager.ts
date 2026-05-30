import axios from "axios";

interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseJwtExpiry(token: string): number {
  const payload = decodeJwtPayload(token);
  const exp = payload?.["exp"];
  return typeof exp === "number" ? exp * 1000 : 0;
}

function extractRefreshCookie(setCookieHeaders: string[] | string | undefined): string | null {
  if (!setCookieHeaders) return null;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const header of headers) {
    const match = header.match(/ahso_refresh_token=([^;]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export class TokenManager {
  private state: TokenState | null = null;
  private loginPromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;

  private get baseUrl(): string {
    return process.env["CRM_BASE_URL"] ?? "https://crm.ahso.vn";
  }
  private get email(): string {
    return process.env["CRM_EMAIL"] ?? "";
  }
  private get password(): string {
    return process.env["CRM_PASSWORD"] ?? "";
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.state) {
      if (!this.loginPromise) {
        this.loginPromise = this.login().finally(() => {
          this.loginPromise = null;
        });
      }
      await this.loginPromise;
      return this.state!.accessToken;
    }

    // Refresh 60s before expiry
    if (Date.now() > this.state.expiresAt - 60_000) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null;
        });
      }
      await this.refreshPromise;
    }

    return this.state!.accessToken;
  }

  async login(): Promise<void> {
    if (!this.email || !this.password) {
      throw new Error("CRM_EMAIL và CRM_PASSWORD chưa được cấu hình trong biến môi trường.");
    }

    const response = await axios.post(
      `${this.baseUrl}/api/auth/login`,
      { email: this.email, password: this.password },
      { timeout: 15_000 }
    );

    // Backend wraps in { data: { accessToken, ... } }
    const body = (response.data?.data ?? response.data) as {
      accessToken: string;
    };
    const accessToken = body.accessToken;
    const setCookies = response.headers["set-cookie"];
    const refreshToken = extractRefreshCookie(setCookies) ?? "";
    const expiresAt = parseJwtExpiry(accessToken) || Date.now() + 14 * 60 * 1000;

    this.state = { accessToken, refreshToken, expiresAt };
  }

  private async doRefresh(): Promise<void> {
    if (!this.state?.refreshToken) {
      await this.login();
      return;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/auth/refresh`,
        {},
        {
          timeout: 15_000,
          headers: {
            Cookie: `ahso_refresh_token=${encodeURIComponent(this.state.refreshToken)}`,
          },
        }
      );

      const body = (response.data?.data ?? response.data) as {
        accessToken: string;
      };
      const accessToken = body.accessToken;
      const setCookies = response.headers["set-cookie"];
      const refreshToken = extractRefreshCookie(setCookies) ?? this.state.refreshToken;
      const expiresAt = parseJwtExpiry(accessToken) || Date.now() + 14 * 60 * 1000;

      this.state = { accessToken, refreshToken, expiresAt };
    } catch {
      // Refresh thất bại — login lại
      await this.login();
    }
  }

  invalidate(): void {
    if (this.state) {
      // Chỉ xóa accessToken, giữ refreshToken để dùng lại
      this.state = { ...this.state, expiresAt: 0 };
    }
  }

  getCurrentUserId(): string | null {
    if (!this.state?.accessToken) return null;
    const payload = decodeJwtPayload(this.state.accessToken);
    const sub = payload?.["sub"];
    return typeof sub === "string" && sub.length > 0 ? sub : null;
  }
}

export const tokenManager = new TokenManager();
