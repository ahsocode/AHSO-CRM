import { PrismaService } from "../common/prisma.service";
import { DashboardService } from "./dashboard.service";

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthRange(date: Date) {
  return {
    dateFrom: toDateOnly(new Date(date.getFullYear(), date.getMonth(), 1)),
    dateTo: toDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  };
}

describe("DashboardService", () => {
  let service: DashboardService;
  let prisma: {
    payment: {
      findMany: jest.Mock;
    };
    project: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    quote: {
      findMany: jest.Mock;
    };
    contract: {
      findMany: jest.Mock;
    };
    activity: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      payment: {
        findMany: jest.fn()
      },
      project: {
        count: jest.fn(),
        findMany: jest.fn()
      },
      quote: {
        findMany: jest.fn()
      },
      contract: {
        findMany: jest.fn()
      },
      activity: {
        findMany: jest.fn()
      }
    };

    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it("calculates KPI summary from completed projects, quotes and contracts", async () => {
    const now = new Date();
    const currentMonthProject = {
      completedAt: now,
      estimatedValue: 150_000_000
    };
    const previousMonthProject = {
      completedAt: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      estimatedValue: 100_000_000
    };

    prisma.project.findMany.mockResolvedValue([currentMonthProject, previousMonthProject]);
    prisma.project.count.mockResolvedValue(4);
    prisma.quote.findMany.mockResolvedValue([
      { total: 200_000_000 },
      { total: 50_000_000 }
    ]);
    prisma.contract.findMany.mockResolvedValue([
      {
        status: "ACTIVE",
        value: 300_000_000,
        payments: [{ amount: 100_000_000 }]
      }
    ]);

    await expect(service.getKpis(getMonthRange(now))).resolves.toEqual({
      monthlyRevenue: {
        value: 150_000_000,
        changePercent: 50,
        trend: [150_000_000]
      },
      activeProjects: {
        value: 4
      },
      pendingQuotes: {
        value: 2,
        totalValue: 250_000_000
      },
      outstandingDebt: {
        value: 200_000_000,
        overdueCustomers: 1
      }
    });
    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: {
            in: ["ACTIVE", "SUSPENDED", "COMPLETED"]
          },
          createdAt: {
            gte: expect.any(Date),
            lt: expect.any(Date)
          }
        })
      })
    );
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date)
          })
        }),
        select: {
          completedAt: true,
          estimatedValue: true
        }
      })
    );
  });

  it("returns null change percent when the previous period has no revenue", async () => {
    const now = new Date();
    prisma.project.findMany.mockResolvedValue([{ completedAt: now, estimatedValue: 150_000_000 }]);
    prisma.project.count.mockResolvedValue(0);
    prisma.quote.findMany.mockResolvedValue([]);
    prisma.contract.findMany.mockResolvedValue([]);

    const result = await service.getKpis(getMonthRange(now));

    expect(result.monthlyRevenue.value).toBe(150_000_000);
    expect(result.monthlyRevenue.changePercent).toBeNull();
  });

  it("keeps dashboard pipeline stages aligned with the project status ledger", async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-survey",
        code: "AHSO-001",
        name: "Khảo sát",
        status: "SURVEY",
        estimatedValue: 10_000_000,
        priority: "NORMAL",
        customer: {
          name: "Khách hàng A"
        }
      },
      {
        id: "project-won",
        code: "AHSO-002",
        name: "Đã ký",
        status: "WON",
        estimatedValue: 20_000_000,
        priority: "HIGH",
        customer: {
          name: "Khách hàng B"
        }
      },
      {
        id: "project-lost",
        code: "AHSO-003",
        name: "Không thành",
        status: "LOST",
        estimatedValue: 30_000_000,
        priority: "LOW",
        customer: {
          name: "Khách hàng C"
        }
      }
    ]);

    await expect(service.getPipeline()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "WON",
          count: 1,
          totalValue: 20_000_000
        }),
        expect.objectContaining({
          status: "LOST",
          count: 1,
          totalValue: 30_000_000
        })
      ])
    );
  });

  describe("getActionItems", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
    const admin = { sub: "admin-1", email: "a@x.vn", name: "A", role: "ADMIN", permissions: [] } as never;
    const staff = { sub: "staff-1", email: "s@x.vn", name: "S", role: "STAFF", permissions: [] } as never;
    const customer = { id: "c1", name: "Orion" };

    beforeEach(() => {
      prisma.quote.findMany.mockResolvedValue([
        { id: "q1", quoteNo: "BG-1", total: 5000000, createdAt: daysAgo(10), project: { name: "P", customer } }
      ]);
      prisma.project.findMany.mockResolvedValue([
        { id: "p1", code: "DA-1", name: "Du an tre", expectedEndDate: daysAgo(3), customer }
      ]);
      prisma.contract.findMany.mockResolvedValue([
        {
          id: "k1", contractNo: "HD-1", value: 100, signDate: daysAgo(30), createdAt: daysAgo(30),
          payments: [{ amount: 40 }], project: { name: "P", customer }
        },
        {
          id: "k2", contractNo: "HD-2", value: 100, signDate: null, createdAt: daysAgo(30),
          payments: [{ amount: 100 }], project: { name: "P", customer }
        }
      ]);
      prisma.activity.findMany.mockResolvedValue([
        { id: "a1", title: "Goi lai", scheduledAt: null, createdAt: daysAgo(2), customer: null }
      ]);
    });

    it("combines the four sources, drops fully paid contracts and orders by priority", async () => {
      const result = await service.getActionItems(admin);

      expect(result.items.map((i) => `${i.kind}:${i.id}`)).toEqual([
        "PROJECT:p1", "CONTRACT:k1", "ACTIVITY:a1", "QUOTE:q1"
      ]);
      expect(result.items[1].amount).toBe(60);
      expect(result.items[2].context).toContain("chưa đặt lịch");
      expect(result.totals).toEqual({ QUOTE: 1, PROJECT: 1, CONTRACT: 1, ACTIVITY: 1 });
    });

    it("caps the list at 8 items", async () => {
      prisma.activity.findMany.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, title: "t", scheduledAt: null, createdAt: daysAgo(1), customer: null }))
      );
      const result = await service.getActionItems(admin);
      expect(result.items).toHaveLength(8);
    });

    it("does not scope ADMIN queries to an assignee", async () => {
      await service.getActionItems(admin);
      const quoteWhere = prisma.quote.findMany.mock.calls[0][0].where;
      expect(quoteWhere.project.customer.assignedToId).toBeUndefined();
      expect(JSON.stringify(prisma.activity.findMany.mock.calls[0][0].where)).not.toContain("staff-1");
    });

    it("scopes every source to the STAFF user's own customers/activities", async () => {
      await service.getActionItems(staff);

      for (const model of [prisma.quote, prisma.contract] as const) {
        const where = model.findMany.mock.calls[0][0].where;
        expect(where.project.customer.assignedToId).toBe("staff-1");
      }
      expect(prisma.project.findMany.mock.calls[0][0].where.customer.assignedToId).toBe("staff-1");
      const activityWhere = JSON.stringify(prisma.activity.findMany.mock.calls[0][0].where);
      expect(activityWhere).toContain('"userId":"staff-1"');
      expect(activityWhere).toContain('"assignedToId":"staff-1"');
    });

    it("filters stale drafts, non-terminal projects and active contracts at query level", async () => {
      await service.getActionItems(admin);
      const q = prisma.quote.findMany.mock.calls[0][0].where;
      expect(q.status).toBe("DRAFT");
      expect(q.sentAt).toBeNull();
      expect(q.createdAt.lt).toBeInstanceOf(Date);
      expect(prisma.project.findMany.mock.calls[0][0].where.status).toEqual({ notIn: ["COMPLETED", "LOST"] });
      expect(prisma.contract.findMany.mock.calls[0][0].where.status).toBe("ACTIVE");
    });
  });
});
