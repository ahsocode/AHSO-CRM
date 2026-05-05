import { PrismaService } from "../common/prisma.service";
import { SearchService } from "./search.service";

describe("SearchService", () => {
  let service: SearchService;
  let prisma: {
    customer: { findMany: jest.Mock };
    project: { findMany: jest.Mock };
    quote: { findMany: jest.Mock };
    contract: { findMany: jest.Mock };
    activity: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      quote: { findMany: jest.fn().mockResolvedValue([]) },
      contract: { findMany: jest.fn().mockResolvedValue([]) },
      activity: { findMany: jest.fn().mockResolvedValue([]) }
    };

    service = new SearchService(prisma as unknown as PrismaService);
  });

  it("queries only resources visible to the current user's permissions", async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Dự án PLC",
        code: "PRJ-001"
      }
    ]);

    await expect(
      service.globalSearch(
        { q: "PLC", limit: 5 },
        {
          sub: "viewer-1",
          email: "viewer@ahso.vn",
          name: "Viewer",
          role: {
            id: "role-viewer",
            name: "VIEWER",
            permissions: ["projects.view"]
          },
          permissions: ["projects.view"]
        }
      )
    ).resolves.toEqual([
      {
        id: "project-1",
        type: "project",
        title: "Dự án PLC",
        subtitle: "PRJ-001",
        href: "/projects/project-1"
      }
    ]);

    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
    expect(prisma.quote.findMany).not.toHaveBeenCalled();
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
  });

  it("scopes staff search results to customers assigned to the staff user", async () => {
    const staffUser = {
      sub: "staff-1",
      email: "staff@ahso.vn",
      name: "Staff",
      role: {
        id: "role-staff",
        name: "STAFF",
        permissions: ["customers.view", "projects.view", "activities.view"]
      },
      permissions: ["customers.view", "projects.view", "activities.view"]
    };

    await service.globalSearch({ q: "AHSO", limit: 3 }, staffUser);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          assignedToId: "staff-1"
        })
      })
    );
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          customer: {
            assignedToId: "staff-1"
          }
        })
      })
    );
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          customer: {
            assignedToId: "staff-1"
          }
        })
      })
    );
    expect(prisma.quote.findMany).not.toHaveBeenCalled();
    expect(prisma.contract.findMany).not.toHaveBeenCalled();
  });
});
