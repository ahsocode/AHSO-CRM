import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { UsersService } from "./users.service";

const managerPerms = ["users.view", "users.edit", "projects.view", "projects.edit"];
const manager: JwtUser = { sub: "u-manager", email: "m@x.vn", name: "M", role: "MANAGER", permissions: managerPerms };
const admin: JwtUser = { sub: "u-admin", email: "a@x.vn", name: "A", role: "ADMIN", permissions: [] };

const roles: Record<string, { id: string; name: string; permissions: Array<{ resource: string; action: string }> }> = {
  role_admin: { id: "role_admin", name: "ADMIN", permissions: [] },
  role_manager: { id: "role_manager", name: "MANAGER", permissions: [{ resource: "users", action: "view" }] },
  role_staff: { id: "role_staff", name: "STAFF", permissions: [{ resource: "projects", action: "view" }] },
  role_power: { id: "role_power", name: "Power", permissions: [{ resource: "roles", action: "edit" }] }
};

function setup(target: { id: string; roleId: string; roleName: string; isActive?: boolean }, otherAdmins = 1) {
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
        where.email ? null : { id: target.id, roleId: target.roleId, isActive: target.isActive ?? true, role: { name: target.roleName } }
      ),
      count: jest.fn(async () => otherAdmins),
      update: jest.fn(async ({ data }: { data: { roleId?: string } }) => ({
        id: target.id, email: "t@x.vn", name: "T", roleId: data.roleId ?? target.roleId, isActive: true,
        avatarUrl: null, createdAt: new Date(), updatedAt: new Date(), role: { name: "X" }
      })),
      create: jest.fn(async () => ({
        id: "new", email: "n@x.vn", name: "N", roleId: "role_staff", isActive: true,
        avatarUrl: null, createdAt: new Date(), updatedAt: new Date(), role: { name: "STAFF" }
      }))
    },
    userRole: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => roles[where.id] ?? null) }
  };
  const email = { sendEmail: jest.fn(async () => undefined) };
  const service = new UsersService(prisma as never, email as never);
  return { service, prisma };
}

describe("UsersService privilege escalation", () => {
  it("blocks a manager from promoting themselves to ADMIN", async () => {
    const { service, prisma } = setup({ id: "u-manager", roleId: "role_manager", roleName: "MANAGER" });
    await expect(service.update("u-manager", { roleId: "role_admin" }, manager)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks a manager from promoting another user to ADMIN", async () => {
    const { service, prisma } = setup({ id: "u-staff", roleId: "role_staff", roleName: "STAFF" });
    await expect(service.update("u-staff", { roleId: "role_admin" }, manager)).rejects.toThrow("Chỉ quản trị viên");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks assigning a custom role with permissions the manager lacks", async () => {
    const { service } = setup({ id: "u-staff", roleId: "role_staff", roleName: "STAFF" });
    await expect(service.update("u-staff", { roleId: "role_power" }, manager)).rejects.toThrow("roles.edit");
  });

  it("blocks a manager from editing or deactivating an admin account", async () => {
    const { service } = setup({ id: "u-admin", roleId: "role_admin", roleName: "ADMIN" });
    await expect(service.update("u-admin", { isActive: false }, manager)).rejects.toThrow(ForbiddenException);
  });

  it("blocks creating an ADMIN user as a manager", async () => {
    const { service, prisma } = setup({ id: "x", roleId: "role_staff", roleName: "STAFF" });
    await expect(
      service.create({ email: "n@x.vn", name: "N", password: "12345678", roleId: "role_admin" }, manager)
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("lets a manager assign roles within their own permissions", async () => {
    const { service, prisma } = setup({ id: "u-staff", roleId: "role_manager", roleName: "MANAGER" });
    await service.update("u-staff", { roleId: "role_staff" }, manager);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("blocks users from changing their own role or deactivating themselves, even admins", async () => {
    const { service } = setup({ id: "u-admin", roleId: "role_admin", roleName: "ADMIN" });
    await expect(service.update("u-admin", { roleId: "role_staff" }, admin)).rejects.toThrow("chính mình");
    await expect(service.update("u-admin", { isActive: false }, admin)).rejects.toThrow("chính mình");
  });

  it("keeps at least one active admin", async () => {
    const { service } = setup({ id: "u-admin-2", roleId: "role_admin", roleName: "ADMIN" }, 0);
    await expect(service.update("u-admin-2", { roleId: "role_staff" }, admin)).rejects.toThrow(BadRequestException);
  });

  it("lets an admin promote a user to ADMIN", async () => {
    const { service, prisma } = setup({ id: "u-staff", roleId: "role_staff", roleName: "STAFF" });
    await service.update("u-staff", { roleId: "role_admin" }, admin);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
