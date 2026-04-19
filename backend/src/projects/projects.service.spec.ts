import { PrismaService } from "../common/prisma.service";
import { WebhooksEmitter } from "../webhooks/webhooks.emitter";
import { ProjectsService } from "./projects.service";

describe("ProjectsService", () => {
  const user = {
    sub: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const,
    permissions: []
  };

  let service: ProjectsService;
  let prisma: {
    customer: {
      findFirst: jest.Mock;
    };
    project: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let webhooksEmitter: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      customer: {
        findFirst: jest.fn()
      },
      project: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      }
    };
    webhooksEmitter = {
      emit: jest.fn()
    };

    service = new ProjectsService(
      prisma as unknown as PrismaService,
      webhooksEmitter as unknown as WebhooksEmitter
    );
  });

  it("creates a project and emits webhook event", async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: "customer-1" });
    prisma.project.findMany.mockResolvedValue([{ code: "AHSO-306" }]);
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      code: "AHSO-307",
      status: "SURVEY",
      estimatedValue: 1_000_000
    });

    await expect(
      service.create(
        {
          customerId: "customer-1",
          name: "Dự án dây chuyền đóng gói",
          status: "SURVEY",
          priority: "NORMAL"
        },
        user
      )
    ).resolves.toEqual({
      id: "project-1",
      code: "AHSO-307"
    });

    expect(webhooksEmitter.emit).toHaveBeenCalledWith("project.created", {
      projectId: "project-1",
      code: "AHSO-307",
      customerId: "customer-1",
      status: "SURVEY",
      estimatedValue: 1_000_000
    });
  });

  it("updates project status and emits status_changed when stage changes", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      customerId: "customer-1",
      status: "QUOTING",
      startDate: null,
      expectedEndDate: null,
      contract: null
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      status: "NEGOTIATING"
    });

    await expect(
      service.updateStatus(
        "project-1",
        {
          status: "NEGOTIATING"
        },
        user
      )
    ).resolves.toEqual({
      id: "project-1",
      status: "NEGOTIATING"
    });

    expect(webhooksEmitter.emit).toHaveBeenCalledWith("project.status_changed", {
      projectId: "project-1",
      previousStatus: "QUOTING",
      status: "NEGOTIATING"
    });
  });
});
