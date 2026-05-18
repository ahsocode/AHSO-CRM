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

  async onModuleDestroy() {
    await Promise.allSettled(
      Array.from(this.connections.values()).map((client) => client.logout().catch(() => client.close()))
    );
    this.connections.clear();
  }
}
