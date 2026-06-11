import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { EmailAccount } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { decrypt } from "../common/utils/crypto.util";

@Injectable()
export class ImapService implements OnModuleDestroy {
  private readonly logger = new Logger(ImapService.name);
  private readonly connections = new Map<string, ImapFlow>();

  async createConnection(account: EmailAccount) {
    const existing = this.connections.get(account.id);

    if (existing?.usable) {
      return existing;
    }

    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapSecure,
      auth: {
        user: account.email,
        pass: decrypt(account.password)
      },
      clientInfo: {
        name: "AHSO CRM",
        vendor: "AHSO"
      },
      logger: false
    });

    await client.connect();
    client.on("close", () => {
      this.connections.delete(account.id);
    });
    client.on("error", (error) => {
      this.logger.warn(`IMAP lỗi cho ${account.email}: ${error.message}`);
      this.connections.delete(account.id);
    });

    this.connections.set(account.id, client);
    return client;
  }

  getConnection(accountId: string) {
    return this.connections.get(accountId) ?? null;
  }

  async getOrCreateConnection(account: EmailAccount) {
    return this.getConnection(account.id) ?? this.createConnection(account);
  }

  closeConnection(accountId: string) {
    const client = this.connections.get(accountId);
    if (!client) {
      return;
    }

    this.connections.delete(accountId);
    client.close();
  }

  async verifyCredentials(email: string, password: string, host = "mail90168.maychuemail.com"): Promise<boolean> {
    return (await this.verifyCredentialsDetailed(email, password, host)) === "valid";
  }

  /**
   * Three-state verification so callers can distinguish "wrong password"
   * (auth must NOT fall back to a stale bcrypt password) from "mail server
   * unreachable" (fallback is acceptable to avoid locking everyone out).
   */
  async verifyCredentialsDetailed(
    email: string,
    password: string,
    host = "mail90168.maychuemail.com"
  ): Promise<"valid" | "invalid" | "unreachable"> {
    const client = new ImapFlow({
      host,
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
      connectionTimeout: 8000
    });

    try {
      await client.connect();
      await client.logout();
      return "valid";
    } catch (error: unknown) {
      const err = error as { authenticationFailed?: boolean; responseStatus?: string; code?: string };
      // ImapFlow marks credential rejections; network/TLS/timeout errors do not
      // carry these flags and mean the server could not be reached.
      if (err?.authenticationFailed === true || err?.responseStatus === "NO") {
        return "invalid";
      }
      return "unreachable";
    }
  }

  async onModuleDestroy() {
    await Promise.allSettled(
      Array.from(this.connections.values()).map((client) => client.logout().catch(() => client.close()))
    );
    this.connections.clear();
  }
}
