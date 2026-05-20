import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    refresh: jest.Mock;
    logoutByRefreshToken: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  const createResponse = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn()
    }) as unknown as Response;

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      refresh: jest.fn(),
      logoutByRefreshToken: jest.fn()
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === "NODE_ENV") {
          return "development";
        }

        return undefined;
      })
    };

    controller = new AuthController(authService as unknown as AuthService, configService as unknown as ConfigService);
  });

  it("sets a persistent refresh cookie on login (maxAge=7d, sameSite=lax, path=/)", async () => {
    const response = createResponse();
    authService.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      sessionId: "session-1",
      user: { id: "user-1" }
    });

    const result = await controller.login(
      { email: "admin@ahso.vn", password: "AHSO123!" },
      {
        ip: "::1",
        get: jest.fn().mockReturnValue("jest")
      } as unknown as Request,
      response
    );

    expect(result).toMatchObject({
      accessToken: "access-token",
      sessionId: "session-1",
      user: { id: "user-1" }
    });

    expect((response as any).cookie).toHaveBeenCalledWith(
      "ahso_refresh_token",
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
    );
  });

  it("reads refresh token from the HttpOnly cookie only", async () => {
    const response = createResponse();
    authService.refresh.mockResolvedValue({
      accessToken: "next-access",
      refreshToken: "next-refresh",
      sessionId: "session-1",
      user: { id: "user-1" }
    });

    await controller.refresh(
      {
        ip: "::1",
        get: jest.fn().mockReturnValue("jest"),
        headers: {
          cookie: "ahso_refresh_token=cookie-refresh-token"
        }
      } as unknown as Request,
      response
    );

    expect(authService.refresh).toHaveBeenCalledWith(
      "cookie-refresh-token",
      expect.objectContaining({ ip: "::1" })
    );
    expect((response as any).cookie).toHaveBeenCalled();
  });

  it("clears refresh cookie and logs out by cookie token", async () => {
    const response = createResponse();
    authService.logoutByRefreshToken.mockResolvedValue({ success: true });

    await expect(
      controller.logout(
        {
          headers: {
            cookie: "other=value; ahso_refresh_token=refresh-token"
          }
        } as Request,
        response
      )
    ).resolves.toEqual({ success: true });

    expect(authService.logoutByRefreshToken).toHaveBeenCalledWith("refresh-token");
    expect((response as any).clearCookie).toHaveBeenCalledWith(
      "ahso_refresh_token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/"
      })
    );
  });
});
