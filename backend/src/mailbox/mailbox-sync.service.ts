import { Injectable, Logger, OnApplicationBootstrap, forwardRef, Inject } from "@nestjs/common";
import { EmailAccount, Prisma } from "@prisma/client";
import { FetchMessageObject, MessageAddressObject, MessageStructureObject } from "imapflow";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { ImapService } from "./imap.service";
import { MailboxSyncQueue } from "./mailbox-sync.queue";
import { MailboxAddress, ParsedMailboxMessage } from "./mailbox.types";

interface AttachmentPart {
  part: string;
  filename: string;
  mimeType: string;
  size: number;
  cid?: string | null;
}

@Injectable()
export class MailboxSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailboxSyncService.name);
  private readonly idleAccounts = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly imapService: ImapService,
    private readonly uploadService: UploadService,
    private readonly websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => MailboxSyncQueue))
    private readonly mailboxSyncQueue: MailboxSyncQueue,
  ) {}

  async onApplicationBootstrap() {
    const accounts = await this.prisma.emailAccount.findMany({ where: { isActive: true } });

    for (const account of accounts) {
      try {
        await this.mailboxSyncQueue.enqueueSync(account.id);
      } catch (error) {
        this.logger.warn(`Không thể xếp hàng sync email ${account.email}: ${this.getErrorMessage(error)}`);
      }
      this.startIdleWatch(account.id);
    }
  }

  async syncAccount(accountId: string) {
    const account = await this.getActiveAccount(accountId);
    const client = await this.imapService.getOrCreateConnection(account);
    const folders = await client.list();

    for (const folder of folders) {
      try {
        await this.syncFolder(accountId, folder.path);
      } catch (error) {
        this.logger.warn(`Bỏ qua folder ${folder.path}: ${this.getErrorMessage(error)}`);
      }
    }

    await this.prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() }
    });
  }

  async syncFolder(accountId: string, folder: string) {
    const account = await this.getActiveAccount(accountId);
    const client = await this.imapService.getOrCreateConnection(account);
    const lock = await client.getMailboxLock(folder);

    try {
      const uids = await client.search({ all: true }, { uid: true });
      if (!uids || uids.length === 0) {
        return;
      }

      const existing = await this.prisma.emailMessage.findMany({
        where: { accountId, folder, uid: { in: uids } },
        select: { uid: true }
      });
      const existingUids = new Set(existing.map((message) => message.uid));
      const missingUids = uids.filter((uid) => !existingUids.has(uid));

      for (let index = 0; index < missingUids.length; index += 50) {
        const batch = missingUids.slice(index, index + 50);
        for await (const message of client.fetch(batch, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          size: true,
          source: true,
          bodyStructure: true
        }, { uid: true })) {
          const saved = await this.saveFetchedMessage(account, folder, message);
          await this.linkEmailToCustomer(saved.id);
        }
      }

      await this.syncFlags(accountId, folder);
    } finally {
      lock.release();
    }
  }

  startIdleWatch(accountId: string) {
    if (this.idleAccounts.has(accountId)) {
      return;
    }

    this.idleAccounts.add(accountId);
    void this.runIdleLoop(accountId);
  }

  async linkEmailToCustomer(messageId: string) {
    const message = await this.prisma.emailMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return;
    }

    const candidates = this.collectMessageEmails(message.fromEmail, message.toAddresses, message.ccAddresses);
    if (candidates.length === 0) {
      return;
    }

    const contact = await this.prisma.contact.findFirst({
      where: {
        email: {
          in: candidates,
          mode: "insensitive"
        }
      },
      select: { customerId: true }
    });

    if (contact) {
      await this.prisma.emailMessage.update({
        where: { id: message.id },
        data: { customerId: contact.customerId }
      });
    }
  }

  async syncFlags(accountId: string, folder: string) {
    const account = await this.getActiveAccount(accountId);
    const client = await this.imapService.getOrCreateConnection(account);
    const lock = await client.getMailboxLock(folder);

    try {
      const uids = await client.search({ all: true }, { uid: true });
      if (!uids || uids.length === 0) {
        return;
      }

      for await (const message of client.fetch(uids, { uid: true, flags: true }, { uid: true })) {
        await this.prisma.emailMessage.updateMany({
          where: { accountId, folder, uid: message.uid },
          data: {
            isRead: Boolean(message.flags?.has("\\Seen")),
            isStarred: Boolean(message.flags?.has("\\Flagged"))
          }
        });
      }
    } finally {
      lock.release();
    }
  }

  private async runIdleLoop(accountId: string) {
    let retries = 0;
    while (this.idleAccounts.has(accountId)) {
      try {
        const account = await this.getActiveAccount(accountId);
        const client = await this.imapService.getOrCreateConnection(account);
        await client.mailboxOpen("INBOX");

        client.once("exists", () => {
          void this.syncNewestInboxMessage(accountId);
        });

        await client.idle();
        retries = 0; // reset on successful idle
      } catch (error) {
        this.logger.warn(`IMAP IDLE ngắt kết nối: ${this.getErrorMessage(error)}`);
        this.imapService.closeConnection(accountId);
        // Exponential backoff: 5s → 15s → 45s → 2m → 5m (max)
        const backoffMs = Math.min(5000 * Math.pow(2, retries), 300_000);
        retries = Math.min(retries + 1, 6);
        await delay(backoffMs);
      }
    }
  }

  private async syncNewestInboxMessage(accountId: string) {
    const before = await this.prisma.emailMessage.count({ where: { accountId, folder: "INBOX" } });
    // Direct sync (not queued) so we can check count immediately for WebSocket notification
    await this.syncFolder(accountId, "INBOX");
    const after = await this.prisma.emailMessage.count({ where: { accountId, folder: "INBOX" } });

    if (after <= before) {
      return;
    }

    const latest = await this.prisma.emailMessage.findFirst({
      where: { accountId, folder: "INBOX" },
      include: { account: true },
      orderBy: { receivedAt: "desc" }
    });

    if (!latest) {
      return;
    }

    this.websocketGateway.publishMailboxNewMessage(latest.account.userId, {
      id: latest.id,
      fromName: latest.fromName,
      fromEmail: latest.fromEmail,
      subject: latest.subject
    });
  }

  private async saveFetchedMessage(account: EmailAccount, folder: string, message: FetchMessageObject) {
    const parsed = this.parseFetchedMessage(folder, message);
    const attachmentParts = this.collectAttachments(message.bodyStructure);
    const attachmentCreates = await this.downloadAttachments(account, folder, message.uid, attachmentParts);

    return this.prisma.emailMessage.upsert({
      where: {
        accountId_uid_folder: {
          accountId: account.id,
          uid: parsed.uid,
          folder
        }
      },
      update: {
        isRead: parsed.isRead,
        isStarred: parsed.isStarred
      },
      create: {
        accountId: account.id,
        uid: parsed.uid,
        folder: parsed.folder,
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        fromName: parsed.fromName,
        fromEmail: parsed.fromEmail,
        toAddresses: this.toJsonAddresses(parsed.toAddresses),
        ccAddresses: this.toJsonAddresses(parsed.ccAddresses),
        bccAddresses: this.toJsonAddresses(parsed.bccAddresses),
        subject: parsed.subject,
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        snippet: parsed.snippet,
        isRead: parsed.isRead,
        isStarred: parsed.isStarred,
        isDraft: parsed.isDraft,
        hasAttachments: attachmentCreates.length > 0 || parsed.hasAttachments,
        size: parsed.size,
        receivedAt: parsed.receivedAt,
        attachments: attachmentCreates.length > 0 ? { create: attachmentCreates } : undefined
      }
    });
  }

  private async downloadAttachments(
    account: EmailAccount,
    folder: string,
    uid: number,
    parts: AttachmentPart[]
  ): Promise<Prisma.EmailAttachmentCreateWithoutMessageInput[]> {
    if (parts.length === 0) {
      return [];
    }

    const client = await this.imapService.getOrCreateConnection(account);
    await client.mailboxOpen(folder);
    const downloads = await client.downloadMany(String(uid), parts.map((part) => part.part), { uid: true });
    const creates: Prisma.EmailAttachmentCreateWithoutMessageInput[] = [];

    for (const part of parts) {
      const download = downloads[part.part];
      if (!download?.content) {
        creates.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.size,
          cid: part.cid
        });
        continue;
      }

      const saved = await this.uploadService.saveBuffer(download.content, {
        originalName: part.filename,
        mimeType: part.mimeType,
        size: part.size,
        subfolder: "email-attachments"
      });

      creates.push({
        filename: part.filename,
        mimeType: part.mimeType,
        size: saved.size,
        filePath: saved.url,
        cid: part.cid
      });
    }

    return creates;
  }

  private parseFetchedMessage(folder: string, message: FetchMessageObject): ParsedMailboxMessage {
    const from = this.firstAddress(message.envelope?.from);
    const body = this.extractBodies(message.source);
    const bodyText = body.text ?? this.stripHtml(body.html ?? "");
    const snippet = bodyText ? bodyText.replace(/\s+/g, " ").trim().slice(0, 200) : null;

    return {
      uid: message.uid,
      folder,
      messageId: message.envelope?.messageId ?? null,
      inReplyTo: message.envelope?.inReplyTo ?? null,
      fromName: from.name ?? null,
      fromEmail: from.email,
      toAddresses: this.normalizeAddresses(message.envelope?.to),
      ccAddresses: this.normalizeAddresses(message.envelope?.cc),
      bccAddresses: this.normalizeAddresses(message.envelope?.bcc),
      subject: message.envelope?.subject ?? null,
      bodyText: bodyText || null,
      bodyHtml: body.html ?? null,
      snippet,
      isRead: Boolean(message.flags?.has("\\Seen")),
      isStarred: Boolean(message.flags?.has("\\Flagged")),
      isDraft: folder.toLowerCase().includes("draft"),
      hasAttachments: this.collectAttachments(message.bodyStructure).length > 0,
      size: message.size ?? message.source?.byteLength ?? 0,
      receivedAt: this.resolveReceivedAt(message)
    };
  }

  private collectAttachments(structure?: MessageStructureObject): AttachmentPart[] {
    if (!structure) {
      return [];
    }

    const current: AttachmentPart[] = [];
    const filename = structure.dispositionParameters?.filename ?? structure.parameters?.name;
    const isAttachment = structure.disposition?.toLowerCase() === "attachment" || Boolean(filename);

    if (isAttachment && structure.part) {
      current.push({
        part: structure.part,
        filename: filename ?? "attachment",
        mimeType: structure.type,
        size: structure.size ?? 0,
        cid: structure.id ?? null
      });
    }

    return current.concat(...(structure.childNodes ?? []).map((child) => this.collectAttachments(child)));
  }

  private extractBodies(source?: Buffer) {
    if (!source) {
      return { text: null, html: null };
    }

    const raw = source.toString("utf8");
    const parts = raw.split(/\r?\n\r?\n/);
    const headers = parts.shift() ?? "";
    const body = parts.join("\n\n");
    const htmlMatch = raw.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|$)/i);
    const textMatch = raw.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|$)/i);
    const isHtml = /Content-Type:\s*text\/html/i.test(headers);
    const isText = /Content-Type:\s*text\/plain/i.test(headers);

    // Detect Content-Transfer-Encoding for each part; fall back to top-level header.
    const topEncoding = (headers.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1] ?? "").toLowerCase();
    const htmlEncoding = this.getPartTransferEncoding(raw, "text/html") || topEncoding;
    const textEncoding = this.getPartTransferEncoding(raw, "text/plain") || topEncoding;

    return {
      text: this.decodeTransferPayload(textMatch?.[1] ?? (isText ? body : null), textEncoding),
      html: this.decodeTransferPayload(htmlMatch?.[1] ?? (isHtml ? body : null), htmlEncoding)
    };
  }

  private getPartTransferEncoding(raw: string, contentType: string): string {
    // Locate the MIME part for this content-type and read its transfer encoding.
    const regex = new RegExp(
      `Content-Type:\\s*${contentType}[\\s\\S]*?Content-Transfer-Encoding:\\s*(\\S+)`,
      "i"
    );
    return (raw.match(regex)?.[1] ?? "").toLowerCase();
  }

  private decodeTransferPayload(value?: string | null, encoding = "") {
    if (!value) {
      return null;
    }

    if (encoding === "base64") {
      try {
        return Buffer.from(value.replace(/[\r\n\s]/g, ""), "base64").toString("utf8");
      } catch {
        return value;
      }
    }

    // quoted-printable (and plain 7bit/8bit — safe to apply soft-wrap strip)
    return value
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .trim();
  }

  private normalizeAddresses(addresses?: MessageAddressObject[]): MailboxAddress[] {
    return (addresses ?? [])
      .filter((address) => Boolean(address.address))
      .map((address) => ({
        name: address.name ?? null,
        email: String(address.address).toLowerCase()
      }));
  }

  private firstAddress(addresses?: MessageAddressObject[]): MailboxAddress {
    return this.normalizeAddresses(addresses)[0] ?? { name: null, email: "unknown@local" };
  }

  private toJsonAddresses(addresses: MailboxAddress[]): Prisma.InputJsonArray {
    return addresses.map((address) => ({
      name: address.name,
      email: address.email
    }));
  }

  private resolveReceivedAt(message: FetchMessageObject) {
    if (message.internalDate instanceof Date) {
      return message.internalDate;
    }

    if (typeof message.internalDate === "string") {
      return new Date(message.internalDate);
    }

    return message.envelope?.date ?? new Date();
  }

  private collectMessageEmails(fromEmail: string, toAddresses: Prisma.JsonValue, ccAddresses: Prisma.JsonValue) {
    const emails = new Set<string>([fromEmail.toLowerCase()]);
    this.extractJsonEmails(toAddresses).forEach((email) => emails.add(email));
    this.extractJsonEmails(ccAddresses).forEach((email) => emails.add(email));
    return Array.from(emails);
  }

  private extractJsonEmails(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (item && typeof item === "object" && "email" in item && typeof item.email === "string") {
          return item.email.toLowerCase();
        }
        return null;
      })
      .filter((email): email is string => Boolean(email));
  }

  private stripHtml(html: string) {
    return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  }

  private async getActiveAccount(accountId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { id: accountId } });

    if (!account || !account.isActive) {
      throw new Error("Tài khoản email chưa được kích hoạt");
    }

    return account;
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "unknown";
  }
}
