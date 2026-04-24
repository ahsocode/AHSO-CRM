import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { PermissionsGuard } from "./permissions.guard";

describe("PermissionsGuard", () => {
  let guard: PermissionsGuard;
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
  };

  const createContext = (user?: unknown) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user })
      })
    }) as any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn()
    };
    prisma = {
      user: {
        findUnique: jest.fn()
      }
    };
    (PermissionsGuard as any).cache.clear();

    guard = new PermissionsGuard(reflector as unknown as Reflector, prisma as unknown as PrismaService);
  });

  it("allows requests when no permissions are required", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it("rejects requests without an authenticated user", async () => {
    reflector.getAllAndOverride.mockReturnValue(["settings.edit"]);

    await expect(guard.canActivate(createContext())).rejects.toEqual(
      new ForbiddenException("Bạn không có quyền thực hiện thao tác này")
    );
  });

  it("allows admin users without hitting prisma", async () => {
    reflector.getAllAndOverride.mockReturnValue(["settings.edit"]);

    await expect(
      guard.canActivate(
        createContext({
          sub: "admin-1",
          role: {
            name: "ADMIN",
            permissions: []
          },
          permissions: []
        })
      )
    ).resolves.toBe(true);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("uses embedded JWT permissions when available", async () => {
    reflector.getAllAndOverride.mockReturnValue(["customers.view"]);

    await expect(
      guard.canActivate(
        createContext({
          sub: "staff-1",
          role: {
            name: "STAFF",
            permissions: ["customers.view"]
          },
          permissions: ["customers.view"]
        })
      )
    ).resolves.toBe(true);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to prisma and caches permissions when JWT payload is empty", async () => {
    reflector.getAllAndOverride.mockReturnValue(["quotes.edit"]);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: {
        name: "MANAGER",
        permissions: [
          { resource: "quotes", action: "edit" }
        ]
      }
    });

    const user = {
      sub: "user-1",
      role: {
        name: "MANAGER",
        permissions: []
      },
      permissions: []
    };

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);
    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects users missing at least one required permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(["customers.edit"]);

    await expect(
      guard.canActivate(
        createContext({
          sub: "staff-1",
          role: {
            name: "STAFF",
            permissions: ["customers.view"]
          },
          permissions: ["customers.view"]
        })
      )
    ).rejects.toEqual(new ForbiddenException("Bạn không có quyền thực hiện thao tác này"));
  });
});
