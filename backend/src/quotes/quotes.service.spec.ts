import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { QuotesService } from "./quotes.service";

describe("QuotesService", () => {
  const user = {
    sub: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const
  };

  let service: QuotesService;
  let prisma: {
    $transaction: jest.Mock;
  };
  let tx: {
    project: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    quote: {
      aggregate: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    tx = {
      project: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      quote: {
        aggregate: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };

    prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };

    service = new QuotesService(prisma as unknown as PrismaService);
  });

  it("creates a quote with calculated totals and moves survey projects into quoting", async () => {
    const currentYear = new Date().getFullYear();
    tx.project.findFirst.mockResolvedValue({
      id: "project-1",
      status: "SURVEY"
    });
    tx.quote.aggregate.mockResolvedValue({
      _max: {
        version: 2
      }
    });
    tx.quote.findFirst.mockResolvedValue({
      quoteNo: `BG-${currentYear}-009`
    });
    tx.quote.create.mockResolvedValue({
      id: "quote-1",
      quoteNo: `BG-${currentYear}-010`
    });

    await expect(
      service.create(
        {
          projectId: "project-1",
          status: "DRAFT",
          taxRate: 10,
          terms: "Thanh toán theo tiến độ",
          deliveryTerms: "Giao tại kho AHSO",
          internalNote: "Ưu tiên chốt trong tháng",
          items: [
            {
              name: "Biến tần công nghiệp",
              quantity: 2,
              unitPrice: 100
            },
            {
              name: "Tủ điều khiển",
              quantity: 1,
              unitPrice: 50
            }
          ]
        },
        user
      )
    ).resolves.toEqual({
      id: "quote-1",
      quoteNo: `BG-${currentYear}-010`
    });

    expect(tx.quote.create).toHaveBeenCalledWith({
      data: {
        quoteNo: `BG-${currentYear}-010`,
        version: 3,
        status: "DRAFT",
        validUntil: undefined,
        subtotal: 250,
        taxRate: 10,
        taxAmount: 25,
        total: 275,
        terms: "Thanh toán theo tiến độ",
        deliveryTerms: "Giao tại kho AHSO",
        internalNote: "Ưu tiên chốt trong tháng",
        sentAt: null,
        acceptedAt: null,
        projectId: "project-1",
        createdById: user.sub,
        items: {
          create: [
            {
              order: 1,
              name: "Biến tần công nghiệp",
              description: undefined,
              unit: undefined,
              quantity: 2,
              unitPrice: 100,
              total: 200
            },
            {
              order: 2,
              name: "Tủ điều khiển",
              description: undefined,
              unit: undefined,
              quantity: 1,
              unitPrice: 50,
              total: 50
            }
          ]
        }
      },
      select: {
        id: true,
        quoteNo: true
      }
    });
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "QUOTING"
      }
    });
  });

  it("accepts a quote and promotes the project to WON", async () => {
    const acceptedAt = new Date("2026-04-18T08:00:00.000Z");
    tx.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      status: "SENT",
      sentAt: null,
      acceptedAt: null,
      projectId: "project-1",
      items: [],
      project: {
        status: "NEGOTIATING",
        contract: null
      }
    });
    tx.quote.update.mockResolvedValue({
      id: "quote-1",
      status: "ACCEPTED",
      sentAt: acceptedAt,
      acceptedAt
    });

    await expect(
      service.updateStatus(
        "quote-1",
        {
          status: "ACCEPTED"
        },
        user
      )
    ).resolves.toEqual({
      id: "quote-1",
      status: "ACCEPTED",
      sentAt: acceptedAt,
      acceptedAt
    });

    expect(tx.quote.update).toHaveBeenCalledWith({
      where: {
        id: "quote-1"
      },
      data: {
        status: "ACCEPTED",
        sentAt: expect.any(Date),
        acceptedAt: expect.any(Date)
      },
      select: {
        id: true,
        status: true,
        sentAt: true,
        acceptedAt: true
      }
    });
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "WON"
      }
    });
  });

  it("prevents duplicating quotes for projects that already have a contract", async () => {
    tx.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      projectId: "project-1",
      items: [],
      project: {
        status: "WON",
        contract: {
          id: "contract-1"
        }
      }
    });

    await expect(service.duplicate("quote-1", user)).rejects.toThrow(
      new BadRequestException("Dự án đã có hợp đồng, không thể tạo version báo giá mới")
    );

    expect(tx.quote.aggregate).not.toHaveBeenCalled();
    expect(tx.quote.create).not.toHaveBeenCalled();
  });
});
