import { PrismaService } from "../common/prisma.service";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  const user = {
    sub: "admin-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const,
    permissions: []
  };

  let service: ReportsService;
  let prisma: {
    $transaction: jest.Mock;
    customer: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    project: {
      findMany: jest.Mock;
    };
    quote: {
      findMany: jest.Mock;
    };
    contract: {
      findMany: jest.Mock;
    };
    payment: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
      customer: {
        findMany: jest.fn(),
        count: jest.fn()
      },
      project: {
        findMany: jest.fn()
      },
      quote: {
        findMany: jest.fn()
      },
      contract: {
        findMany: jest.fn()
      },
      payment: {
        findMany: jest.fn()
      }
    };

    service = new ReportsService(prisma as unknown as PrismaService);
  });

  it("aggregates top customers without double-counting contract value", async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        amount: 50_000_000,
        contract: {
          id: "contract-1",
          value: 200_000_000,
          project: {
            id: "project-1",
            customer: {
              id: "customer-1",
              name: "Khách hàng A"
            }
          }
        }
      },
      {
        amount: 70_000_000,
        contract: {
          id: "contract-1",
          value: 200_000_000,
          project: {
            id: "project-1",
            customer: {
              id: "customer-1",
              name: "Khách hàng A"
            }
          }
        }
      }
    ]);

    await expect(service.getTopCustomers({ months: 3, topLimit: 5 }, user)).resolves.toEqual([
      {
        customerId: "customer-1",
        name: "Khách hàng A",
        paidAmount: 120_000_000,
        contractValue: 200_000_000,
        projectCount: 1
      }
    ]);
  });

  it("builds customer journey links from distinct customer intersections instead of raw table counts", async () => {
    prisma.customer.findMany.mockResolvedValue([{ id: "customer-1" }, { id: "customer-2" }, { id: "customer-3" }]);
    prisma.project.findMany.mockResolvedValue([{ customerId: "customer-1" }, { customerId: "customer-2" }]);
    prisma.quote.findMany.mockResolvedValue([
      { project: { customerId: "customer-1" }, status: "SENT" },
      { project: { customerId: "customer-2" }, status: "ACCEPTED" }
    ]);
    prisma.contract.findMany
      .mockResolvedValueOnce([{ project: { customerId: "customer-2" } }])
      .mockResolvedValueOnce([{ project: { customerId: "customer-2" } }]);
    prisma.payment.findMany.mockResolvedValue([{ contract: { project: { customerId: "customer-2" } } }]);

    await expect(service.getCustomerJourney({ months: 3, topLimit: 5 }, user)).resolves.toEqual({
      nodes: [
        { id: "lead", label: "Lead" },
        { id: "project", label: "Dự án" },
        { id: "quote", label: "Báo giá" },
        { id: "contract", label: "Hợp đồng" },
        { id: "closed", label: "Chốt thành công" }
      ],
      links: [
        { source: "lead", target: "project", value: 2 },
        { source: "project", target: "quote", value: 2 },
        { source: "quote", target: "contract", value: 1 },
        { source: "contract", target: "closed", value: 1 }
      ]
    });
  });

  it("calculates money overview from issued quotes and receivable contracts only", async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        amount: 50_000_000,
        paidAt: new Date(),
        contract: {
          contractNo: "HD-001",
          project: {
            name: "Dự án A",
            customer: {
              name: "Khách hàng A"
            }
          }
        }
      }
    ]);
    prisma.project.findMany.mockResolvedValue([{ estimatedValue: 100_000_000 }]);
    prisma.quote.findMany.mockResolvedValue([
      { status: "DRAFT" },
      { status: "SENT" },
      { status: "ACCEPTED" },
      { status: "REJECTED" }
    ]);
    prisma.contract.findMany.mockResolvedValue([
      {
        status: "ACTIVE",
        value: 300_000_000,
        payments: [{ amount: 100_000_000 }]
      },
      {
        status: "COMPLETED",
        value: 120_000_000,
        payments: [{ amount: 120_000_000 }]
      }
    ]);
    prisma.customer.count.mockResolvedValue(2);

    await expect(service.getOverview({ months: 6, topLimit: 5 }, user)).resolves.toMatchObject({
      collectionsValue: 50_000_000,
      openPipelineValue: 100_000_000,
      outstandingDebt: 200_000_000,
      quoteAcceptanceRate: 33.3,
      activeContracts: 1,
      activeCustomers: 2
    });

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["ACTIVE", "SUSPENDED", "COMPLETED"]
          }
        })
      })
    );
    expect(prisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lt: expect.any(Date)
          })
        })
      })
    );
  });
});
