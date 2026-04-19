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
    payment: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
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
});
