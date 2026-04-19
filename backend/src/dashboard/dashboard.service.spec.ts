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
  });
});
