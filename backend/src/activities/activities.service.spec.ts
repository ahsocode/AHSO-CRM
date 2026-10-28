import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ActivitiesService } from "./activities.service";

describe("ActivitiesService", () => {
  const staffUser = {
    sub: "staff-1",
    email: "staff@ahso.vn",
    name: "Staff",
    role: "STAFF" as const,
    permissions: []
  };

  let service: ActivitiesService;
  let prisma: {
    customer: {
      findUnique: jest.Mock;
    };
    project: {
      findUnique: jest.Mock;
    };
    activity: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notificationsService: {
    createMentionNotifications: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      customer: {
        findUnique: jest.fn()
      },
      project: {
        findUnique: jest.fn()
      },
      activity: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops))
    };
    notificationsService = {
      createMentionNotifications: jest.fn().mockResolvedValue([])
    };

    service = new ActivitiesService(
      prisma as unknown as PrismaService,
      notificationsService as unknown as NotificationsService
    );
  });

  it("blocks staff from creating activity for customer assigned to another owner", async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: "customer-1",
      assignedToId: "other-user"
    });

    await expect(
      service.create(
        {
          type: "CALL",
          title: "Nhắc follow-up",
          customerId: "customer-1"
        },
        staffUser
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates activity for assigned customer", async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: "customer-1",
      assignedToId: staffUser.sub
    });
    prisma.activity.create.mockResolvedValue({
      id: "activity-1",
      title: "Gọi xác nhận nhu cầu",
      type: "CALL",
      customer: {
        id: "customer-1",
        name: "Khách hàng A"
      },
      project: null,
      user: {
        id: staffUser.sub,
        name: "Staff"
      }
    });

    await expect(
      service.create(
        {
          type: "CALL",
          title: "Gọi xác nhận nhu cầu",
          customerId: "customer-1"
        },
        staffUser
      )
    ).resolves.toMatchObject({
      id: "activity-1",
      title: "Gọi xác nhận nhu cầu"
    });
  });

  it("rejects activity creation when selected project belongs to another customer", async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: "customer-1",
      assignedToId: staffUser.sub
    });
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      customerId: "customer-2",
      customer: {
        assignedToId: staffUser.sub
      }
    });

    await expect(
      service.create(
        {
          type: "CALL",
          title: "Gọi xác nhận nhu cầu",
          customerId: "customer-1",
          projectId: "project-1"
        },
        staffUser
      )
    ).rejects.toThrow(new BadRequestException("Dự án không thuộc khách hàng đã chọn"));

    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  describe("list scoping", () => {
    const adminUser = { ...staffUser, sub: "admin-1", role: "ADMIN" as const };
    const managerUser = { ...staffUser, sub: "manager-1", role: "MANAGER" as const };
    const staffCustomerScope = { assignedToId: staffUser.sub, assignedTo: { isActive: true } };
    const expectedStaffScope = [
      {
        OR: [
          { customer: staffCustomerScope },
          { customerId: null, project: { customer: staffCustomerScope } },
          { customerId: null, projectId: null, userId: staffUser.sub }
        ]
      }
    ];

    const capturedWhere = () => {
      const findManyWhere = prisma.activity.findMany.mock.calls[0][0].where;
      const countWhere = prisma.activity.count.mock.calls[0][0].where;
      expect(countWhere).toEqual(findManyWhere);
      return findManyWhere;
    };

    it("scopes STAFF list to own customers, own customers' projects, and own unlinked activities", async () => {
      await service.findAll({ page: 1, limit: 10 }, staffUser);

      expect(capturedWhere()).toEqual({ deletedAt: null, AND: expectedStaffScope });
    });

    it.each([
      ["ADMIN", adminUser],
      ["MANAGER", managerUser]
    ])("does not scope the list for %s", async (_role, user) => {
      await service.findAll({ page: 1, limit: 10 }, user);

      const where = capturedWhere();
      expect(where).toEqual({ deletedAt: null });
      expect(where.AND).toBeUndefined();
    });

    it("keeps the search OR intact for STAFF and applies the scope through AND", async () => {
      await service.findAll({ page: 1, limit: 10, search: "báo giá" }, staffUser);

      const where = capturedWhere();
      expect(where.OR).toEqual([
        { title: { contains: "báo giá", mode: "insensitive" } },
        { content: { contains: "báo giá", mode: "insensitive" } }
      ]);
      expect(where.AND).toEqual(expectedStaffScope);
    });

    it("does not widen STAFF visibility when filtering by another user's id", async () => {
      await service.findAll({ page: 1, limit: 10, userId: "other-user" }, staffUser);

      const where = capturedWhere();
      expect(where.userId).toBe("other-user");
      expect(where.AND).toEqual(expectedStaffScope);
    });

    it("scopes the STAFF trash list as well", async () => {
      await service.findDeleted({ page: 1, limit: 10, search: "x" }, staffUser);

      const where = capturedWhere();
      expect(where.deletedAt).toEqual({ not: null });
      expect(where.AND).toEqual(expectedStaffScope);
      expect(where.OR).toHaveLength(2);
    });

    it("does not scope the trash list for ADMIN", async () => {
      await service.findDeleted({ page: 1, limit: 10 }, adminUser);

      expect(capturedWhere()).toEqual({ deletedAt: { not: null } });
    });
  });

  describe("STAFF per-record access (findOne / restore) matches the list scope", () => {
    const base = { id: "a1", userId: "someone-else", customerId: null, projectId: null, deletedAt: null, customer: null, project: null, user: null };

    it("forbids a project-only activity whose project customer belongs to another owner", async () => {
      prisma.activity.findFirst.mockResolvedValue({ ...base, projectId: "p1" });
      prisma.project.findUnique.mockResolvedValue({ customer: { assignedToId: "other-owner" } });

      await expect(service.findOne("a1", staffUser)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("allows a project-only activity whose project customer is assigned to the user", async () => {
      prisma.activity.findFirst.mockResolvedValue({ ...base, projectId: "p1" });
      prisma.project.findUnique.mockResolvedValue({ customer: { assignedToId: staffUser.sub } });

      await expect(service.findOne("a1", staffUser)).resolves.toMatchObject({ id: "a1" });
    });

    it("forbids an unattached activity created by someone else, allows the user's own", async () => {
      prisma.activity.findFirst.mockResolvedValue({ ...base });
      await expect(service.findOne("a1", staffUser)).rejects.toBeInstanceOf(ForbiddenException);

      prisma.activity.findFirst.mockResolvedValue({ ...base, userId: staffUser.sub });
      await expect(service.findOne("a1", staffUser)).resolves.toMatchObject({ id: "a1" });
    });

    it("update and remove are blocked by the same check", async () => {
      prisma.activity.findFirst.mockResolvedValue({ ...base });

      await expect(service.update("a1", { title: "x" } as never, staffUser)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remove("a1", staffUser)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.activity.update).not.toHaveBeenCalled();
    });

    it("restore uses the same rule: own unattached item is restorable, another's is not", async () => {
      const deleted = { ...base, deletedAt: new Date() };
      prisma.activity.findFirst.mockResolvedValue(deleted);
      await expect(service.restore("a1", staffUser)).rejects.toBeInstanceOf(ForbiddenException);

      prisma.activity.findFirst.mockResolvedValue({ ...deleted, userId: staffUser.sub });
      prisma.activity.update.mockResolvedValue({ id: "a1" });
      await expect(service.restore("a1", staffUser)).resolves.toBeDefined();
    });
  });
});
