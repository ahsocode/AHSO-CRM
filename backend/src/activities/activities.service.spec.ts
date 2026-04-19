import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
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
    };
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
        create: jest.fn()
      }
    };

    service = new ActivitiesService(prisma as unknown as PrismaService);
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
});
