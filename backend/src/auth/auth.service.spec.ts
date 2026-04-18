import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../common/prisma.service";
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
    refreshToken: "stored-refresh-hash",
    avatarUrl: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z")
  };

  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
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

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn()
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
      JWT_RESET_SECRET: "reset-secret",
      JWT_RESET_EXPIRES_IN: "15m"
    };
    configService = {
      get: jest.fn((key: string) => configValues[key])
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService
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

  it("issues a password reset token and exposes a debug reset url in development", async () => {
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
  });

  it("resets the password and invalidates existing refresh tokens", async () => {
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
    prisma.user.update.mockResolvedValue({
      id: activeUser.id
    });

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
    expect(hashMock).toHaveBeenCalledWith("AHSO123!New", 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: activeUser.id
      },
      data: {
        password: "hashed-next-password",
        refreshToken: null
      }
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
});
