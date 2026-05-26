import { Injectable, Logger, OnApplicationBootstrap, forwardRef, Inject } from "@nestjs/common";
import { EmailAccount, Prisma } from "@prisma/client";
import { FetchMessageObject, MessageAddressObject } from "imapflow";
import { ParsedMail, ParsedMailAddressObject, ParsedMailAttachment, simpleParser } from "mailparser";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { ImapService } from "./imap.service";
import { MailboxSyncQueue } from "./mailbox-sync.queue";
import { MailboxAddress, ParsedMailboxMessage } from "./mailbox.types";

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
          source: true
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
    const { parsed, attachmentCreates } = await this.parseFetchedMessage(folder, message);

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

  private async parseFetchedMessage(
    folder: string,
    message: FetchMessageObject
  ): Promise<{
    parsed: ParsedMailboxMessage;
    attachmentCreates: Prisma.EmailAttachmentCreateWithoutMessageInput[];
  }> {
    let mail: ParsedMail | null = null;
    if (message.source) {
      try {
        mail = await simpleParser(message.source);
      } catch (error) {
        this.logger.warn(`Không thể parse MIME message ${message.uid}: ${this.getErrorMessage(error)}`);
      }
    }
    const parsedFrom = this.firstParsedAddress(mail?.from);
    const from = parsedFrom ?? this.firstAddress(message.envelope?.from);
    const bodyHtml = typeof mail?.html === "string" ? mail.html : null;
    const bodyText = mail?.text ?? this.stripHtml(bodyHtml ?? "");
    const snippet = bodyText ? bodyText.replace(/\s+/g, " ").trim().slice(0, 200) : null;
    const attachmentCreates = await this.createAttachmentsFromParsed(mail?.attachments ?? []);

    return {
      parsed: {
        uid: message.uid,
        folder,
        messageId: mail?.messageId ?? message.envelope?.messageId ?? null,
        inReplyTo: mail?.inReplyTo ?? message.envelope?.inReplyTo ?? null,
        fromName: from.name ?? null,
        fromEmail: from.email,
        toAddresses: this.normalizeParsedAddresses(mail?.to, message.envelope?.to),
        ccAddresses: this.normalizeParsedAddresses(mail?.cc, message.envelope?.cc),
        bccAddresses: this.normalizeParsedAddresses(mail?.bcc, message.envelope?.bcc),
        subject: mail?.subject ?? message.envelope?.subject ?? null,
        bodyText: bodyText || null,
        bodyHtml,
        snippet,
        isRead: Boolean(message.flags?.has("\\Seen")),
        isStarred: Boolean(message.flags?.has("\\Flagged")),
        isDraft: folder.toLowerCase().includes("draft"),
        hasAttachments: attachmentCreates.length > 0,
        size: message.size ?? message.source?.byteLength ?? 0,
        receivedAt: mail?.date ?? this.resolveReceivedAt(message)
      },
      attachmentCreates
    };
  }

  private async createAttachmentsFromParsed(
    attachments: ParsedMailAttachment[]
  ): Promise<Prisma.EmailAttachmentCreateWithoutMessageInput[]> {
    const creates: Prisma.EmailAttachmentCreateWithoutMessageInput[] = [];

    for (const attachment of attachments) {
      const filename = attachment.filename ?? "attachment";
      const mimeType = attachment.contentType ?? "application/octet-stream";
      const size = attachment.size ?? attachment.content?.byteLength ?? 0;
      const cid = attachment.cid?.replace(/^<|>$/g, "") ?? null;

      if (!attachment.content || attachment.content.byteLength === 0) {
        creates.push({ filename, mimeType, size, cid });
        continue;
      }

      const saved = await this.uploadService.saveBuffer(attachment.content, {
        originalName: filename,
        mimeType,
        size,
        subfolder: "email-attachments"
      });

      creates.push({
        filename,
        mimeType,
        size: saved.size,
        filePath: saved.url,
        cid
      });
    }

    return creates;
  }

  private normalizeParsedAddresses(
    parsedAddresses?: ParsedMailAddressObject | ParsedMailAddressObject[],
    fallback?: MessageAddressObject[]
  ): MailboxAddress[] {
    const addressObjects = Array.isArray(parsedAddresses)
      ? parsedAddresses
      : parsedAddresses
        ? [parsedAddresses]
        : [];
    const addresses = addressObjects.flatMap((addressObject) => addressObject.value ?? []);
    const normalized = addresses
      .filter((address) => Boolean(address.address))
      .map((address) => ({
        name: address.name ?? null,
        email: String(address.address).toLowerCase()
      }));

    return normalized.length > 0 ? normalized : this.normalizeAddresses(fallback);
  }

  private firstParsedAddress(addresses?: ParsedMailAddressObject): MailboxAddress | null {
    return this.normalizeParsedAddresses(addresses)[0] ?? null;
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
