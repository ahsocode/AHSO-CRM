import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { EmailService } from "../email/email.service";
import { AuthService } from "./auth.service";

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

describe("AuthService", () => {
  const activeUser = {
    id: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN",
    password: "stored-password-hash",
    avatarUrl: null,
    isActive: true,
    sessions: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z")
  };

  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    userSession: {
      deleteMany: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
    decode: jest.Mock;
  };
  let configValues: Record<string, string | undefined>;
  let configService: {
    get: jest.Mock;
  };
  let emailService: {
    sendEmail: jest.Mock;
  };
  let auditService: {
    recordLogin: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      userSession: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: "session-1" })
      }
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn()
    };
    configValues = {
      NODE_ENV: "development",
      FRONTEND_URL: "http://localhost:3000",
      JWT_SECRET: "jwt-secret",
      JWT_REFRESH_SECRET: "refresh-secret",
      JWT_RESET_SECRET: "reset-secret",
      JWT_RESET_EXPIRES_IN: "15m"
    };
    configService = {
      get: jest.fn((key: string) => configValues[key])
    };
    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true })
    };
    auditService = {
      recordLogin: jest.fn().mockResolvedValue(undefined)
    };

    const websocketGateway = {
      publishSessionInvalidated: jest.fn()
    };

    const imapService = { verifyCredentials: jest.fn().mockResolvedValue(false) };
    const mailboxSyncService = { syncAccount: jest.fn(), startIdleWatch: jest.fn() };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      emailService as unknown as EmailService,
      auditService as unknown as AuditService,
      websocketGateway as unknown as import("../websocket/websocket.gateway").WebsocketGateway,
      imapService as unknown as import("../mailbox/imap.service").ImapService,
      mailboxSyncService as unknown as import("../mailbox/mailbox-sync.service").MailboxSyncService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns a generic forgot-password response when the user does not exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.forgotPassword({ email: "missing@ahso.vn" })).resolves.toEqual({
      success: true,
      message: "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được xếp vào hàng đợi gửi."
    });

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("issues a password reset token and exposes a debug reset url in development with DEBUG_RESET=true", async () => {
    configValues["DEBUG_RESET"] = "true";
    prisma.user.findUnique.mockResolvedValue(activeUser);
    jwtService.signAsync.mockResolvedValue("reset-token");

    await expect(service.forgotPassword({ email: activeUser.email })).resolves.toEqual({
      success: true,
      message: "Nếu email tồn tại trong hệ thống, hướng dẫn khôi phục đã được xếp vào hàng đợi gửi.",
      debug: {
        resetToken: "reset-token",
        resetUrl: "http://localhost:3000/reset-password?token=reset-token"
      }
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: activeUser.id,
        email: activeUser.email,
        type: "password-reset"
      },
      {
        secret: "reset-secret:stored-password-hash",
        expiresIn: "15m"
      }
    );
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      activeUser.email,
      "Yêu cầu đặt lại mật khẩu AHSO CRM",
      "password-reset",
      expect.objectContaining({
        email: activeUser.email,
        resetUrl: "http://localhost:3000/reset-password?token=reset-token"
      })
    );
  });

  it("resets the password and invalidates all sessions", async () => {
    const hashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
    hashMock.mockResolvedValue("hashed-next-password" as never);
    jwtService.decode.mockReturnValue({
      sub: activeUser.id,
      email: activeUser.email,
      type: "password-reset"
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: activeUser.id,
      email: activeUser.email,
      type: "password-reset"
    });
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.user.update.mockResolvedValue({ id: activeUser.id });

    await expect(
      service.resetPassword({
        token: "reset-token",
        password: "AHSO123!New",
        confirmPassword: "AHSO123!New"
      })
    ).resolves.toEqual({
      success: true,
      message: "Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại."
    });

    expect(jwtService.verifyAsync).toHaveBeenCalledWith("reset-token", {
      secret: "reset-secret:stored-password-hash"
    });
    expect(hashMock).toHaveBeenCalledWith("AHSO123!New", 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { password: "hashed-next-password" }
    });
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: activeUser.id }
    });
  });

  it("rejects invalid password reset tokens", async () => {
    jwtService.decode.mockReturnValue(null);

    await expect(
      service.resetPassword({
        token: "invalid-token",
        password: "AHSO123!New",
        confirmPassword: "AHSO123!New"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("refreshes by tokenHash lookup and compares exactly one stored refresh token", async () => {
    const hashMock = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
    const compareMock = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
    const refreshToken = "refresh-token";
    const nextRefreshToken = "next-refresh-token";
    const tokenHash = createHash("sha256").update(refreshToken).digest("hex");
    const nextTokenHash = createHash("sha256").update(nextRefreshToken).digest("hex");
    const session = {
      id: "session-1",
      userId: activeUser.id,
      refreshToken: "stored-refresh-hash",
      ipAddress: "127.0.0.1",
      userAgent: "Chrome",
      user: {
        ...activeUser,
        role: {
          id: "role-admin",
          name: "ADMIN",
          permissions: []
        }
      }
    };
    jwtService.verifyAsync.mockResolvedValue({ sub: activeUser.id, email: activeUser.email });
    jwtService.signAsync
      .mockResolvedValueOnce("next-access-token")
      .mockResolvedValueOnce(nextRefreshToken);
    hashMock.mockResolvedValue("next-refresh-hash" as never);
    compareMock.mockResolvedValue(true as never);
    prisma.userSession.findUnique.mockResolvedValue(session);
    prisma.userSession.update.mockResolvedValue({ id: session.id });

    await expect(service.refresh(refreshToken, { ip: "10.0.0.1", userAgent: "Safari" }))
      .resolves.toMatchObject({
        accessToken: "next-access-token",
        refreshToken: nextRefreshToken,
        sessionId: session.id
      });

    expect(prisma.userSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
        }
      }
    });
    expect(compareMock).toHaveBeenCalledTimes(1);
    expect(compareMock).toHaveBeenCalledWith(refreshToken, "stored-refresh-hash");
    expect(prisma.userSession.update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: {
        refreshToken: "next-refresh-hash",
        tokenHash: nextTokenHash,
        lastActiveAt: expect.any(Date),
        ipAddress: "10.0.0.1",
        userAgent: "Safari"
      }
    });
  });
});
