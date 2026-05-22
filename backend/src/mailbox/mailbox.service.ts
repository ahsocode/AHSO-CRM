import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EmailAccount, Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { JwtUser, isAdmin } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decrypt, encrypt } from "../common/utils/crypto.util";
import { UploadService } from "../upload/upload.service";
import { BulkActionDto } from "./dto/bulk-action.dto";
import { CreateEmailAccountDto } from "./dto/create-email-account.dto";
import { SaveDraftDto } from "./dto/draft.dto";
import { GetMessagesDto } from "./dto/get-messages.dto";
import { ReplyDto } from "./dto/reply.dto";
import { SendEmailDto } from "./dto/send-email.dto";
import { SetupPasswordDto } from "./dto/setup-password.dto";
import { UpdateSignatureDto } from "./dto/update-signature.dto";
import { ImapService } from "./imap.service";
import { MailboxSyncService } from "./mailbox-sync.service";
import { FolderInfo, MailboxAddress } from "./mailbox.types";

@Injectable()
export class MailboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imapService: ImapService,
    private readonly syncService: MailboxSyncService,
    private readonly uploadService: UploadService
  ) {}

  async setupAccount(userId: string, dto: SetupPasswordDto) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new NotFoundException("Admin chưa tạo tài khoản email cho người dùng này");
    }

    const encryptedPassword = encrypt(dto.password);
    const candidate: EmailAccount = {
      ...account,
      password: encryptedPassword,
      isActive: true
    };

    const client = await this.imapService.createConnection(candidate);
    await client.logout().catch(() => client.close());
    this.imapService.closeConnection(candidate.id);

    await this.prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        password: encryptedPassword,
        isActive: true
      }
    });

    void this.syncService.syncAccount(account.id);
    this.syncService.startIdleWatch(account.id);

    return { success: true, message: "Đã kết nối tài khoản email" };
  }

  async createAccountByAdmin(dto: CreateEmailAccountDto) {
    return this.prisma.emailAccount.upsert({
      where: { userId: dto.userId },
      update: {
        email: dto.email,
        imapHost: dto.imapHost,
        imapPort: dto.imapPort,
        imapSecure: dto.imapSecure,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        isActive: false
      },
      create: {
        userId: dto.userId,
        email: dto.email,
        imapHost: dto.imapHost,
        imapPort: dto.imapPort,
        imapSecure: dto.imapSecure,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        password: encrypt(""),
        isActive: false
      }
    });
  }

  async bulkCreateAccounts(imapHost: string, smtpHost: string) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, emailAccount: null },
      select: { id: true, email: true }
    });

    if (users.length === 0) {
      return { created: 0, message: "Tất cả người dùng đã có tài khoản email" };
    }

    await this.prisma.emailAccount.createMany({
      data: users.map((user) => ({
        userId: user.id,
        email: user.email,
        imapHost,
        imapPort: 993,
        imapSecure: true,
        smtpHost,
        smtpPort: 587,
        password: encrypt(""),
        isActive: false
      })),
      skipDuplicates: true
    });

    return {
      created: users.length,
      message: `Đã tạo ${users.length} tài khoản email. Mỗi nhân viên cần vào Settings → Email để nhập mật khẩu iRedMail của mình.`
    };
  }

  listAccounts() {
    return this.prisma.emailAccount.findMany({
      select: {
        id: true,
        userId: true,
        email: true,
        imapHost: true,
        imapPort: true,
        smtpHost: true,
        smtpPort: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async deleteAccount(accountId: string) {
    this.imapService.closeConnection(accountId);
    await this.prisma.emailAccount.delete({ where: { id: accountId } });
    return { success: true, message: "Đã xóa tài khoản email" };
  }

  async testAccountConnection(accountId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Không tìm thấy tài khoản email");
    const ok = await this.imapService.verifyCredentials(account.email, account.password, account.imapHost);
    return {
      success: ok,
      message: ok ? "Kết nối IMAP thành công" : "Không thể kết nối — kiểm tra lại mật khẩu và host",
    };
  }

  async triggerAccountSync(accountId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Không tìm thấy tài khoản email");
    await this.syncService.syncAccount(account.id);
    return { message: "Đã sync email" };
  }

  async getFolders(userId: string): Promise<FolderInfo[]> {
    const account = await this.requireUserAccount(userId);

    const rows = await this.prisma.emailMessage.groupBy({
      by: ["folder"],
      where: { accountId: account.id },
      _count: { _all: true }
    });

    if (rows.length === 0) {
      return [];
    }

    const unreadRows = await this.prisma.emailMessage.groupBy({
      by: ["folder"],
      where: { accountId: account.id, isRead: false },
      _count: { _all: true }
    });

    const unreadMap = new Map(unreadRows.map((r) => [r.folder, r._count._all]));

    const FOLDER_ORDER = ["INBOX", "Sent", "Drafts", "Trash", "Spam", "Junk"];
    return rows
      .map((r) => ({
        name: r.folder.split("/").pop() ?? r.folder,
        path: r.folder,
        delimiter: "/",
        specialUse: null,
        total: r._count._all,
        unread: unreadMap.get(r.folder) ?? 0
      }))
      .sort((a, b) => {
        const ai = FOLDER_ORDER.indexOf(a.path);
        const bi = FOLDER_ORDER.indexOf(b.path);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.path.localeCompare(b.path);
      });
  }

  async getMessages(userId: string, query: GetMessagesDto) {
    const account = await this.requireUserAccount(userId);
    const where: Prisma.EmailMessageWhereInput = {
      accountId: account.id,
      folder: query.folder,
      customerId: query.customerId
    };

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: "insensitive" } },
        { fromEmail: { contains: query.search, mode: "insensitive" } },
        { fromName: { contains: query.search, mode: "insensitive" } },
        { bodyText: { contains: query.search, mode: "insensitive" } }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where,
        include: { attachments: true, customer: { select: { id: true, name: true } } },
        orderBy: { receivedAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      this.prisma.emailMessage.count({ where })
    ]);

    return {
      items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  async getMessage(userId: string, messageId: string) {
    const message = await this.requireUserMessage(userId, messageId);

    if (!message.isRead) {
      await this.markRead(userId, messageId, true);
    }

    return this.requireUserMessage(userId, messageId);
  }

  async sendEmail(userId: string, dto: SendEmailDto) {
    const account = await this.requireUserAccount(userId);
    const password = decrypt(account.password);
    const bodyText = dto.bodyText ?? this.stripHtml(dto.bodyHtml);

    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465,
      auth: {
        user: account.email,
        pass: password
      }
    });

    const attachmentPayloads = await this.resolveAttachments(dto.attachments);

    const mailOptions = {
      from: account.email,
      to: dto.to.join(", "),
      cc: dto.cc.join(", ") || undefined,
      bcc: dto.bcc.join(", ") || undefined,
      subject: dto.subject,
      html: dto.bodyHtml,
      text: bodyText,
      ...(attachmentPayloads.length > 0 && { attachments: attachmentPayloads })
    };

    const sent = await transporter.sendMail(mailOptions as Parameters<typeof transporter.sendMail>[0]);

    const client = await this.imapService.getOrCreateConnection(account);
    const raw = this.buildRawEmail(account.email, dto, bodyText, sent.messageId);
    const appendResult = await client.append("Sent", raw, ["\\Seen"], new Date());

    await this.prisma.emailMessage.create({
      data: {
        accountId: account.id,
        uid: appendResult && appendResult.uid ? appendResult.uid : Date.now(),
        folder: "Sent",
        messageId: typeof sent.messageId === "string" ? sent.messageId : null,
        fromEmail: account.email,
        toAddresses: this.toJsonAddresses(dto.to),
        ccAddresses: this.toJsonAddresses(dto.cc),
        bccAddresses: this.toJsonAddresses(dto.bcc),
        subject: dto.subject,
        bodyText,
        bodyHtml: dto.bodyHtml,
        snippet: bodyText.slice(0, 200),
        isRead: true,
        size: Buffer.byteLength(raw),
        receivedAt: new Date()
      }
    });

    return { success: true, message: "Đã gửi email" };
  }

  async replyEmail(userId: string, messageId: string, dto: ReplyDto) {
    const original = await this.requireUserMessage(userId, messageId);
    const recipients = dto.replyAll
      ? Array.from(new Set([original.fromEmail, ...this.extractJsonEmails(original.toAddresses)]))
      : [original.fromEmail];

    return this.sendEmail(userId, {
      to: recipients,
      cc: dto.replyAll ? this.extractJsonEmails(original.ccAddresses) : [],
      bcc: [],
      subject: original.subject?.startsWith("Re:") ? original.subject : `Re: ${original.subject ?? ""}`,
      bodyHtml: dto.bodyHtml,
      bodyText: dto.bodyText,
      attachments: []
    });
  }

  async markRead(userId: string, messageId: string, isRead: boolean) {
    const message = await this.requireUserMessage(userId, messageId);
    await this.applyFlag(message.account, message.folder, message.uid, "\\Seen", isRead);
    await this.prisma.emailMessage.update({ where: { id: messageId }, data: { isRead } });
    return { success: true };
  }

  async starMessage(userId: string, messageId: string, isStarred: boolean) {
    const message = await this.requireUserMessage(userId, messageId);
    await this.applyFlag(message.account, message.folder, message.uid, "\\Flagged", isStarred);
    await this.prisma.emailMessage.update({ where: { id: messageId }, data: { isStarred } });
    return { success: true };
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.requireUserMessage(userId, messageId);
    const client = await this.imapService.getOrCreateConnection(message.account);
    await client.mailboxOpen(message.folder);
    await client.messageMove([message.uid], "Trash", { uid: true });
    await this.prisma.emailMessage.update({ where: { id: messageId }, data: { folder: "Trash" } });
    return { success: true };
  }

  async getCustomerEmails(userId: string, customerId: string) {
    const account = await this.requireUserAccount(userId);
    return this.prisma.emailMessage.findMany({
      where: { accountId: account.id, customerId },
      include: { attachments: true },
      orderBy: { receivedAt: "desc" }
    });
  }

  async syncAllAccounts(user: JwtUser) {
    if (!isAdmin(user)) {
      throw new ForbiddenException("Chỉ admin được chạy đồng bộ thủ công toàn hệ thống");
    }

    const accounts = await this.prisma.emailAccount.findMany({ where: { isActive: true } });
    accounts.forEach((account) => {
      void this.syncService.syncAccount(account.id);
    });

    return { success: true, message: "Đã đưa các tài khoản email vào hàng đợi đồng bộ" };
  }

  async syncMyAccount(userId: string) {
    const account = await this.requireUserAccount(userId);
    await this.syncService.syncAccount(account.id);
    return { success: true, message: "Đồng bộ hoàn tất" };
  }

  async downloadAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.emailAttachment.findFirst({
      where: {
        id: attachmentId,
        message: {
          account: { userId }
        }
      }
    });

    if (!attachment?.filePath) {
      throw new NotFoundException("Không tìm thấy file đính kèm");
    }

    const stored = await this.uploadService.readStoredFile(attachment.filePath);
    if (!stored) {
      throw new NotFoundException("File đính kèm không còn tồn tại");
    }

    return {
      ...stored,
      filename: attachment.filename
    };
  }

  private async requireUserAccount(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new NotFoundException("Chưa cấu hình tài khoản email");
    }
    if (!account.isActive) {
      throw new BadRequestException("Tài khoản email chưa được kết nối");
    }
    return account;
  }

  private async requireUserMessage(userId: string, messageId: string) {
    const message = await this.prisma.emailMessage.findFirst({
      where: {
        id: messageId,
        account: { userId }
      },
      include: { account: true, attachments: true, customer: { select: { id: true, name: true } } }
    });

    if (!message) {
      throw new NotFoundException("Không tìm thấy email");
    }

    return message;
  }

  private async applyFlag(account: EmailAccount, folder: string, uid: number, flag: string, enabled: boolean) {
    const client = await this.imapService.getOrCreateConnection(account);
    await client.mailboxOpen(folder);
    if (enabled) {
      await client.messageFlagsAdd([uid], [flag], { uid: true });
    } else {
      await client.messageFlagsRemove([uid], [flag], { uid: true });
    }
  }

  private toJsonAddresses(emails: string[]): Prisma.InputJsonArray {
    return emails.map((email) => ({ name: null, email }));
  }

  private extractJsonEmails(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (item && typeof item === "object" && "email" in item && typeof item.email === "string") {
          return item.email;
        }
        return null;
      })
      .filter((email): email is string => Boolean(email));
  }

  private buildRawEmail(from: string, dto: SendEmailDto, bodyText: string, messageId?: string | false) {
    const headers = [
      `From: ${from}`,
      `To: ${dto.to.join(", ")}`,
      dto.cc.length > 0 ? `Cc: ${dto.cc.join(", ")}` : null,
      `Subject: ${dto.subject}`,
      messageId ? `Message-ID: ${messageId}` : null,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="utf-8"',
      "Content-Transfer-Encoding: 8bit"
    ].filter((header): header is string => Boolean(header));

    return `${headers.join("\r\n")}\r\n\r\n${dto.bodyHtml || bodyText}`;
  }

  // ─── Signature ────────────────────────────────────────────────────────────

  async getSignature(userId: string) {
    const account = await this.prisma.emailAccount.findUnique({ where: { userId }, select: { signature: true } });
    return { signature: account?.signature ?? "" };
  }

  async updateSignature(userId: string, dto: UpdateSignatureDto) {
    await this.prisma.emailAccount.update({ where: { userId }, data: { signature: dto.signature } });
    return { success: true };
  }

  // ─── Drafts ───────────────────────────────────────────────────────────────

  async saveDraft(userId: string, dto: SaveDraftDto) {
    const account = await this.requireUserAccount(userId);
    const draftId = dto.draftId ?? randomUUID();
    const bodyText = this.stripHtml(dto.bodyHtml);

    await this.prisma.emailMessage.upsert({
      where: { draftId },
      update: {
        toAddresses: this.toJsonAddresses(dto.to),
        ccAddresses: this.toJsonAddresses(dto.cc),
        bccAddresses: this.toJsonAddresses(dto.bcc),
        subject: dto.subject || null,
        bodyHtml: dto.bodyHtml,
        bodyText,
        snippet: bodyText.slice(0, 200),
        receivedAt: new Date()
      },
      create: {
        accountId: account.id,
        uid: Date.now(),
        folder: "Drafts",
        draftId,
        isDraft: true,
        fromEmail: account.email,
        toAddresses: this.toJsonAddresses(dto.to),
        ccAddresses: this.toJsonAddresses(dto.cc),
        bccAddresses: this.toJsonAddresses(dto.bcc),
        subject: dto.subject || null,
        bodyHtml: dto.bodyHtml,
        bodyText,
        snippet: bodyText.slice(0, 200),
        isRead: true,
        size: Buffer.byteLength(dto.bodyHtml),
        receivedAt: new Date()
      }
    });

    return { draftId };
  }

  async deleteDraft(userId: string, draftId: string) {
    const account = await this.requireUserAccount(userId);
    await this.prisma.emailMessage.deleteMany({ where: { draftId, accountId: account.id } });
    return { success: true };
  }

  // ─── Contacts autocomplete ────────────────────────────────────────────────

  async searchContacts(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const [contacts, users] = await Promise.all([
      this.prisma.contact.findMany({
        where: { email: { contains: q, mode: "insensitive" } },
        select: { name: true, email: true },
        take: 8
      }),
      this.prisma.user.findMany({
        where: { email: { contains: q, mode: "insensitive" }, isActive: true },
        select: { name: true, email: true },
        take: 5
      })
    ]);

    const seen = new Set<string>();
    return [...contacts, ...users]
      .filter((item) => {
        if (!item.email || seen.has(item.email)) return false;
        seen.add(item.email);
        return true;
      })
      .map((item) => ({ name: item.name, email: item.email! }));
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────

  async bulkAction(userId: string, dto: BulkActionDto) {
    const account = await this.requireUserAccount(userId);
    const where: Prisma.EmailMessageWhereInput = { id: { in: dto.ids }, accountId: account.id };

    switch (dto.action) {
      case "markRead":
        await this.prisma.emailMessage.updateMany({ where, data: { isRead: true } });
        break;
      case "markUnread":
        await this.prisma.emailMessage.updateMany({ where, data: { isRead: false } });
        break;
      case "star":
        await this.prisma.emailMessage.updateMany({ where, data: { isStarred: true } });
        break;
      case "unstar":
        await this.prisma.emailMessage.updateMany({ where, data: { isStarred: false } });
        break;
      case "delete":
        await this.prisma.emailMessage.deleteMany({ where });
        break;
    }

    return { success: true, affected: dto.ids.length };
  }

  // ─── Attachment upload ────────────────────────────────────────────────────

  async uploadAttachmentFile(userId: string, file: Express.Multer.File) {
    await this.requireUserAccount(userId);
    const saved = await this.uploadService.saveFile(file, "email-attachments");
    return { path: saved.url, filename: file.originalname, size: file.size, mimeType: file.mimetype };
  }

  private async resolveAttachments(paths: string[]) {
    if (!paths.length) return [];

    const uploadRoot = process.env.UPLOAD_DIR ?? "./uploads";
    const results: { filename: string; content: Buffer; contentType: string }[] = [];

    for (const p of paths) {
      try {
        const relative = p.startsWith("/uploads/") ? p.slice("/uploads/".length) : p;
        const abs = resolve(join(uploadRoot, relative));
        const content = await readFile(abs);
        const filename = relative.split("/").pop() ?? "attachment";
        results.push({ filename, content, contentType: "application/octet-stream" });
      } catch {
        // skip unreadable files
      }
    }

    return results;
  }

  private stripHtml(html: string) {
    return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").trim();
  }
}
