import { PrismaService } from "../common/prisma.service";
import { DashboardService } from "./dashboard.service";

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

  it("calculates KPI summary from payments, quotes and contracts", async () => {
    const now = new Date();
    const currentMonthPayment = {
      amount: 150_000_000,
      paidAt: now
    };
    const previousMonthPayment = {
      amount: 100_000_000,
      paidAt: new Date(now.getFullYear(), now.getMonth() - 1, 15)
    };

    prisma.payment.findMany.mockResolvedValue([currentMonthPayment, previousMonthPayment]);
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

    await expect(service.getKpis()).resolves.toEqual({
      monthlyRevenue: {
        value: 150_000_000,
        changePercent: 50
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
        where: {
          deletedAt: null,
          status: {
            in: ["ACTIVE", "SUSPENDED", "COMPLETED"]
          }
        }
      })
    );
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
});
