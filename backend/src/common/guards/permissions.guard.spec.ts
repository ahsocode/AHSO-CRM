import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } from "../decorators/permissions.decorator";
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

  const mockRequiredPermissions = (all?: string[], any?: string[]) => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === PERMISSIONS_KEY) {
        return all;
      }

      if (key === ANY_PERMISSIONS_KEY) {
        return any;
      }

      return undefined;
    });
  };

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
    mockRequiredPermissions();

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it("rejects requests without an authenticated user", async () => {
    mockRequiredPermissions(["settings.edit"]);

    await expect(guard.canActivate(createContext())).rejects.toEqual(
      new ForbiddenException("Bạn không có quyền thực hiện thao tác này")
    );
  });

  it("allows admin users without hitting prisma", async () => {
    mockRequiredPermissions(["settings.edit"]);

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
    mockRequiredPermissions(["customers.view"]);

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
    mockRequiredPermissions(["quotes.edit"]);
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
    mockRequiredPermissions(["customers.edit"]);

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

  it("allows requests when at least one any-permission matches", async () => {
    mockRequiredPermissions(undefined, ["customers.view", "projects.view"]);

    await expect(
      guard.canActivate(
        createContext({
          sub: "staff-1",
          role: {
            name: "STAFF",
            permissions: ["projects.view"]
          },
          permissions: ["projects.view"]
        })
      )
    ).resolves.toBe(true);
  });

  it("rejects any-permission requests when none match", async () => {
    mockRequiredPermissions(undefined, ["customers.view", "projects.view"]);

    await expect(
      guard.canActivate(
        createContext({
          sub: "staff-1",
          role: {
            name: "STAFF",
            permissions: ["activities.view"]
          },
          permissions: ["activities.view"]
        })
      )
    ).rejects.toEqual(new ForbiddenException("Bạn không có quyền thực hiện thao tác này"));
  });

  it("requires both all-permission and any-permission conditions when both are configured", async () => {
    mockRequiredPermissions(["reports.view"], ["customers.view", "projects.view"]);

    await expect(
      guard.canActivate(
        createContext({
          sub: "manager-1",
          role: {
            name: "MANAGER",
            permissions: ["reports.view", "customers.view"]
          },
          permissions: ["reports.view", "customers.view"]
        })
      )
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        createContext({
          sub: "manager-2",
          role: {
            name: "MANAGER",
            permissions: ["reports.view"]
          },
          permissions: ["reports.view"]
        })
      )
    ).rejects.toEqual(new ForbiddenException("Bạn không có quyền thực hiện thao tác này"));
  });
});
