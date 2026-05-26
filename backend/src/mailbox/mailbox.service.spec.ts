import { EmailAccount } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { encrypt } from "../common/utils/crypto.util";
import { UploadService } from "../upload/upload.service";
import { ImapService } from "./imap.service";
import { MailboxService } from "./mailbox.service";
import { MailboxSyncService } from "./mailbox-sync.service";

interface PrismaMock {
  emailAccount: {
    findUnique: jest.Mock;
  };
  emailMessage: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
}

interface ImapClientMock {
  list: jest.Mock;
  mailboxOpen: jest.Mock;
  messageMove: jest.Mock;
}

interface ImapMock {
  verifyCredentials: jest.Mock;
  getOrCreateConnection: jest.Mock;
}

describe("MailboxService", () => {
  let prisma: PrismaMock;
  let imapService: ImapMock;
  let service: MailboxService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "12345678901234567890123456789012";
  });

  beforeEach(() => {
    prisma = {
      emailAccount: {
        findUnique: jest.fn()
      },
      emailMessage: {
        findFirst: jest.fn(),
        update: jest.fn()
      }
    };
    imapService = {
      verifyCredentials: jest.fn(),
      getOrCreateConnection: jest.fn()
    };
    service = new MailboxService(
      prisma as never as PrismaService,
      imapService as never as ImapService,
      {} as never as MailboxSyncService,
      {} as never as UploadService
    );
  });

  it("testAccountConnection decrypts stored password before testing IMAP", async () => {
    const account = createAccount({ password: encrypt("mail-secret"), isActive: true });
    prisma.emailAccount.findUnique.mockResolvedValue(account);
    imapService.verifyCredentials.mockResolvedValue(true);

    await expect(service.testAccountConnection(account.id)).resolves.toEqual({
      success: true,
      message: "Kết nối IMAP thành công"
    });

    expect(imapService.verifyCredentials).toHaveBeenCalledWith(account.email, "mail-secret", account.imapHost);
  });

  it("testAccountConnection does not try an inactive account without a user password", async () => {
    const account = createAccount({ isActive: false });
    prisma.emailAccount.findUnique.mockResolvedValue(account);

    await expect(service.testAccountConnection(account.id)).resolves.toEqual({
      success: false,
      message: "Tài khoản email chưa được người dùng nhập mật khẩu"
    });

    expect(imapService.verifyCredentials).not.toHaveBeenCalled();
  });

  it("deleteMessage uses the IMAP trash special-use folder when available", async () => {
    const account = createAccount();
    const client: ImapClientMock = {
      list: jest.fn().mockResolvedValue([
        { path: "INBOX", specialUse: "\\Inbox" },
        { path: "Deleted Items", specialUse: "\\Trash" }
      ]),
      mailboxOpen: jest.fn(),
      messageMove: jest.fn()
    };
    prisma.emailMessage.findFirst.mockResolvedValue({
      id: "message-1",
      account,
      folder: "INBOX",
      uid: 42
    });
    prisma.emailMessage.update.mockResolvedValue({ id: "message-1" });
    imapService.getOrCreateConnection.mockResolvedValue(client);

    await expect(service.deleteMessage("user-1", "message-1")).resolves.toEqual({ success: true });

    expect(client.messageMove).toHaveBeenCalledWith([42], "Deleted Items", { uid: true });
    expect(prisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: { folder: "Deleted Items" }
    });
  });

  it("bulkAction reports per-message failures instead of hiding partial sync results", async () => {
    prisma.emailAccount.findUnique.mockResolvedValue(createAccount());
    jest.spyOn(service, "markRead")
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error("IMAP unavailable"));

    await expect(service.bulkAction("user-1", {
      ids: ["message-1", "message-2"],
      action: "markRead"
    })).resolves.toEqual({
      success: false,
      affected: 1,
      failed: [{ id: "message-2", message: "IMAP unavailable" }],
      message: "Đã xử lý 1/2 email. 1 email chưa đồng bộ được với máy chủ."
    });
  });
});

function createAccount(overrides: Partial<EmailAccount> = {}): EmailAccount {
  const now = new Date("2026-05-26T00:00:00.000Z");
  return {
    id: "account-1",
    userId: "user-1",
    email: "hung@ahso.vn",
    imapHost: "mail.ahso.vn",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "mail.ahso.vn",
    smtpPort: 587,
    password: encrypt("mail-secret"),
    signature: "",
    lastSyncAt: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
