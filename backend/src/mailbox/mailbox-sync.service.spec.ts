import { EmailAccount } from "@prisma/client";
import type { ParsedMail } from "mailparser";
import { PrismaService } from "../common/prisma.service";
import { UploadService } from "../upload/upload.service";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { ImapService } from "./imap.service";
import { MailboxSyncQueue } from "./mailbox-sync.queue";
import { MailboxSyncService } from "./mailbox-sync.service";

const mockSimpleParser = jest.fn();

jest.mock("mailparser", () => ({
  simpleParser: (...args: unknown[]) => mockSimpleParser(...args)
}));

interface PrismaMock {
  emailAccount: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  emailMessage: {
    findMany: jest.Mock;
    upsert: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  contact: {
    findFirst: jest.Mock;
  };
}

interface UploadMock {
  saveBuffer: jest.Mock;
}

interface ImapClientMock {
  list: jest.Mock;
  getMailboxLock: jest.Mock;
  search: jest.Mock;
  fetch: jest.Mock;
}

describe("MailboxSyncService", () => {
  let prisma: PrismaMock;
  let uploadService: UploadMock;
  let imapClient: ImapClientMock;
  let service: MailboxSyncService;

  beforeEach(() => {
    mockSimpleParser.mockReset();
    prisma = {
      emailAccount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
      },
      emailMessage: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn()
      },
      contact: {
        findFirst: jest.fn()
      }
    };
    uploadService = {
      saveBuffer: jest.fn()
    };
    imapClient = {
      list: jest.fn(),
      getMailboxLock: jest.fn(),
      search: jest.fn(),
      fetch: jest.fn()
    };
    const imapService = {
      getOrCreateConnection: jest.fn().mockResolvedValue(imapClient),
      closeConnection: jest.fn()
    };
    service = new MailboxSyncService(
      prisma as never as PrismaService,
      imapService as never as ImapService,
      uploadService as never as UploadService,
      { publishMailboxNewMessage: jest.fn() } as never as WebsocketGateway,
      { enqueueSync: jest.fn() } as never as MailboxSyncQueue
    );
  });

  it("syncFolder parses MIME with MailParser and stores html, text, addresses and attachments", async () => {
    const account = createAccount();
    const release = jest.fn();
    const raw = Buffer.from("raw MIME message");
    const parsedMail: ParsedMail = {
      subject: "Báo giá mới",
      messageId: "<message-1@mail.ahso.vn>",
      inReplyTo: "<previous@mail.ahso.vn>",
      date: new Date("2026-05-26T03:00:00.000Z"),
      text: "Xin chào AHSO",
      html: "<p>Xin chào AHSO</p>",
      from: { value: [{ name: "Khách hàng", address: "customer@example.com" }] },
      to: { value: [{ name: "Sales", address: "sales@ahso.vn" }] },
      cc: { value: [{ name: "CC", address: "cc@example.com" }] },
      attachments: [{
        filename: "po.pdf",
        contentType: "application/pdf",
        content: Buffer.from("%PDF"),
        size: 4,
        cid: "<po-inline>"
      }]
    };

    prisma.emailAccount.findUnique.mockResolvedValue(account);
    prisma.emailMessage.findMany.mockResolvedValue([]);
    prisma.emailMessage.upsert.mockResolvedValue({ id: "message-1" });
    prisma.emailMessage.findUnique.mockResolvedValue({
      id: "message-1",
      fromEmail: "customer@example.com",
      toAddresses: [{ email: "sales@ahso.vn" }],
      ccAddresses: [{ email: "cc@example.com" }]
    });
    prisma.contact.findFirst.mockResolvedValue({ customerId: "customer-1" });
    prisma.emailMessage.update.mockResolvedValue({ id: "message-1" });
    prisma.emailMessage.updateMany.mockResolvedValue({ count: 1 });
    uploadService.saveBuffer.mockResolvedValue({
      url: "/uploads/email-attachments/po.pdf",
      size: 4
    });
    mockSimpleParser.mockResolvedValue(parsedMail);
    imapClient.getMailboxLock.mockResolvedValue({ release });
    imapClient.search.mockResolvedValue([42]);
    imapClient.fetch.mockImplementation((_uids: number[], options: { source?: boolean }) => {
      if (options.source) {
        return asyncMessages([{
          uid: 42,
          flags: new Set(["\\Seen"]),
          source: raw,
          size: raw.byteLength,
          internalDate: new Date("2026-05-26T03:00:00.000Z")
        }]);
      }

      return asyncMessages([{
        uid: 42,
        flags: new Set(["\\Seen", "\\Flagged"])
      }]);
    });

    await service.syncFolder(account.id, "INBOX");

    expect(mockSimpleParser).toHaveBeenCalledWith(raw);
    expect(uploadService.saveBuffer).toHaveBeenCalledWith(Buffer.from("%PDF"), {
      originalName: "po.pdf",
      mimeType: "application/pdf",
      size: 4,
      subfolder: "email-attachments"
    });
    expect(prisma.emailMessage.upsert).toHaveBeenCalledWith({
      where: {
        accountId_uid_folder: {
          accountId: account.id,
          uid: 42,
          folder: "INBOX"
        }
      },
      update: {
        isRead: true,
        isStarred: false
      },
      create: expect.objectContaining({
        accountId: account.id,
        uid: 42,
        folder: "INBOX",
        messageId: "<message-1@mail.ahso.vn>",
        inReplyTo: "<previous@mail.ahso.vn>",
        fromName: "Khách hàng",
        fromEmail: "customer@example.com",
        subject: "Báo giá mới",
        bodyText: "Xin chào AHSO",
        bodyHtml: "<p>Xin chào AHSO</p>",
        snippet: "Xin chào AHSO",
        isRead: true,
        isStarred: false,
        hasAttachments: true,
        size: raw.byteLength,
        receivedAt: new Date("2026-05-26T03:00:00.000Z"),
        attachments: {
          create: [{
            filename: "po.pdf",
            mimeType: "application/pdf",
            size: 4,
            filePath: "/uploads/email-attachments/po.pdf",
            cid: "po-inline"
          }]
        }
      })
    });
    expect(prisma.emailMessage.updateMany).toHaveBeenCalledWith({
      where: { accountId: account.id, folder: "INBOX", uid: 42 },
      data: { isRead: true, isStarred: true }
    });
    expect(release).toHaveBeenCalledTimes(2);
  });
});

async function* asyncMessages<T>(messages: T[]): AsyncGenerator<T> {
  for (const message of messages) {
    yield message;
  }
}

function createAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  const now = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: "account-1",
    userId: "user-1",
    email: "sales@ahso.vn",
    imapHost: "mail.ahso.vn",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "mail.ahso.vn",
    smtpPort: 587,
    password: "encrypted",
    signature: "",
    lastSyncAt: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
