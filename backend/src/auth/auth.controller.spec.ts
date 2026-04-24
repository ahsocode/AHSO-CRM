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

        if (key === "JWT_REFRESH_EXPIRES_IN") {
          return "7d";
        }

        return undefined;
      })
    };

    controller = new AuthController(authService as unknown as AuthService, configService as unknown as ConfigService);
  });

  it("sets a secure refresh cookie contract on login", async () => {
    const response = createResponse();
    authService.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1"
      }
    });

    await expect(
      controller.login(
        { email: "admin@ahso.vn", password: "AHSO123!" },
        {
          ip: "::1",
          get: jest.fn().mockReturnValue("jest")
        } as unknown as Request,
        response
      )
    ).resolves.toEqual({
      accessToken: "access-token",
      user: {
        id: "user-1"
      }
    });

    expect((response as any).cookie).toHaveBeenCalledWith(
      "ahso_refresh_token",
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 604800000
      })
    );
  });

  it("reads refresh token from cookie when request body omits it", async () => {
    const response = createResponse();
    authService.refresh.mockResolvedValue({
      accessToken: "next-access",
      refreshToken: "next-refresh",
      user: {
        id: "user-1"
      }
    });

    await controller.refresh(
      {},
      {
        headers: {
          cookie: "ahso_refresh_token=cookie-refresh-token"
        }
      } as Request,
      response
    );

    expect(authService.refresh).toHaveBeenCalledWith("cookie-refresh-token");
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
