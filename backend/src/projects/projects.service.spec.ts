import { PrismaService } from "../common/prisma.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DocumentsService } from "../documents/documents.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
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
    $transaction: jest.Mock;
    customer: {
      findFirst: jest.Mock;
    };
    project: {
      count: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let customFieldsService: {
    saveValues: jest.Mock;
  };
  let domainEvents: {
    emit: jest.Mock;
  };
  let documentsService: {
    renderPdf: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
      customer: {
        findFirst: jest.fn()
      },
      project: {
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      }
    };
    customFieldsService = {
      saveValues: jest.fn().mockResolvedValue(undefined)
    };
    domainEvents = {
      emit: jest.fn()
    };
    documentsService = {
      renderPdf: jest.fn()
    };

    service = new ProjectsService(
      prisma as unknown as PrismaService,
      customFieldsService as unknown as CustomFieldsService,
      domainEvents as unknown as DomainEventsService,
      documentsService as unknown as DocumentsService
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
          priority: "NORMAL",
          customFieldValues: {}
        },
        user
      )
    ).resolves.toEqual({
      id: "project-1",
      code: "AHSO-307"
    });

    expect(domainEvents.emit).toHaveBeenCalledWith("project.created", {
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
      completedAt: null,
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

    expect(domainEvents.emit).toHaveBeenCalledWith("project.status_changed", {
      projectId: "project-1",
      previousStatus: "QUOTING",
      status: "NEGOTIATING"
    });
  });

  it("sets completedAt when a project is completed", async () => {
    const completedAt = new Date("2026-05-25T00:00:00.000Z");
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      customerId: "customer-1",
      status: "DELIVERING",
      completedAt: null,
      startDate: null,
      expectedEndDate: null,
      contract: null
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      status: "COMPLETED",
      completedAt
    });

    await expect(
      service.updateStatus(
        "project-1",
        {
          status: "COMPLETED",
          completedAt
        },
        user
      )
    ).resolves.toEqual({
      id: "project-1",
      status: "COMPLETED",
      completedAt
    });

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "COMPLETED",
        completedAt
      }
    });
  });

  it("does not reset completedAt when editing an already completed project", async () => {
    const completedAt = new Date("2026-04-30T00:00:00.000Z");
    prisma.project.findFirst.mockResolvedValue({
      id: "project-1",
      customerId: "customer-1",
      status: "COMPLETED",
      completedAt,
      startDate: null,
      expectedEndDate: null,
      contract: null
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1"
    });

    await expect(
      service.update(
        "project-1",
        {
          name: "Dự án đã nghiệm thu",
          status: "COMPLETED",
          customFieldValues: {}
        },
        user
      )
    ).resolves.toEqual({
      id: "project-1"
    });

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: expect.objectContaining({
        name: "Dự án đã nghiệm thu",
        status: "COMPLETED",
        completedAt
      })
    });
  });

  it("excludes closed projects from pipeline summary value while keeping them in list results", async () => {
    const openProject = {
      id: "project-open",
      code: "AHSO-001",
      name: "Dự án mở",
      description: null,
      status: "WON",
      priority: "NORMAL",
      estimatedValue: 100_000_000,
      startDate: null,
      expectedEndDate: null,
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      activities: [],
      customer: {
        id: "customer-1",
        name: "Khách hàng A",
        industry: null,
        status: "ACTIVE",
        assignedTo: {
          id: "user-1",
          name: "Admin",
          role: "ADMIN"
        }
      },
      contract: null,
      _count: {
        quotes: 0,
        milestones: 0,
        activities: 0
      }
    };
    const completedProject = {
      ...openProject,
      id: "project-completed",
      code: "AHSO-002",
      name: "Dự án hoàn thành",
      status: "COMPLETED",
      estimatedValue: 300_000_000
    };
    const lostProject = {
      ...openProject,
      id: "project-lost",
      code: "AHSO-003",
      name: "Dự án mất",
      status: "LOST",
      estimatedValue: 500_000_000
    };

    prisma.project.count.mockResolvedValue(3);
    prisma.project.findMany
      .mockResolvedValueOnce([
        { id: "project-open", status: "WON", estimatedValue: 100_000_000, expectedEndDate: null },
        { id: "project-completed", status: "COMPLETED", estimatedValue: 300_000_000, expectedEndDate: null },
        { id: "project-lost", status: "LOST", estimatedValue: 500_000_000, expectedEndDate: null }
      ])
      .mockResolvedValueOnce([openProject, completedProject, lostProject]);

    await expect(service.findAll({ page: 1, limit: 10, view: "list" }, user)).resolves.toMatchObject({
      items: [
        { id: "project-open" },
        { id: "project-completed" },
        { id: "project-lost" }
      ],
      meta: {
        total: 3,
        summary: {
          pipelineValue: 100_000_000,
          activeProjects: 1
        }
      }
    });
  });
});
