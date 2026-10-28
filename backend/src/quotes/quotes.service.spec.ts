import { BadRequestException } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../common/prisma.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { QuotesService } from "./quotes.service";

describe("QuotesService", () => {
  const user = {
    sub: "user-1",
    email: "admin@ahso.vn",
    name: "Admin",
    role: "ADMIN" as const,
    permissions: []
  };

  let service: QuotesService;
  let prisma: {
    $transaction: jest.Mock;
  };
  let tx: {
    $executeRaw: jest.Mock;
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
  let moduleRef: {
    get: jest.Mock;
  };
  let emailService: {
    sendEmail: jest.Mock;
  };
  let domainEvents: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
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
    moduleRef = {
      get: jest.fn()
    };
    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true })
    };
    domainEvents = {
      emit: jest.fn()
    };

    service = new QuotesService(
      prisma as unknown as PrismaService,
      moduleRef as unknown as ModuleRef,
      emailService as unknown as EmailService,
      domainEvents as unknown as DomainEventsService
    );
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
          tableColumnWidths: {
            index: 5,
            name: 38,
            description: 30,
            quantity: 5,
            unitPrice: 10,
            total: 12
          },
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
        tableColumnWidths: {
          index: 5,
          name: 38,
          description: 30,
          quantity: 5,
          unitPrice: 10,
          total: 12
        },
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
              total: 200,
              taxRate: 10
            },
            {
              order: 2,
              name: "Tủ điều khiển",
              description: undefined,
              unit: undefined,
              quantity: 1,
              unitPrice: 50,
              total: 50,
              taxRate: 10
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
        status: "QUOTING",
        stageChangedAt: expect.any(Date)
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
      total: 275,
      taxRate: 10,
      projectId: "project-1",
      items: [
        {
          id: "quote-item-1",
          total: 100,
          taxRate: 10
        },
        {
          id: "quote-item-2",
          total: 150,
          taxRate: 10
        }
      ],
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
        acceptedItemIds: ["quote-item-1", "quote-item-2"],
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
        status: "WON",
        estimatedValue: 275,
        stageChangedAt: expect.any(Date)
      }
    });
  });

  it("syncs the project value from accepted quote items only", async () => {
    const acceptedAt = new Date("2026-04-18T08:00:00.000Z");
    tx.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      status: "SENT",
      sentAt: null,
      acceptedAt: null,
      total: 660,
      taxRate: 10,
      projectId: "project-1",
      items: [
        {
          id: "quote-item-1",
          total: 100,
          taxRate: 10
        },
        {
          id: "quote-item-2",
          total: 500,
          taxRate: 10
        }
      ],
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

    await service.updateStatus(
      "quote-1",
      {
        status: "ACCEPTED",
        acceptedItemIds: ["quote-item-2"]
      },
      user
    );

    expect(tx.quote.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        acceptedItemIds: ["quote-item-2"]
      })
    }));
    expect(tx.project.update).toHaveBeenCalledWith({
      where: {
        id: "project-1"
      },
      data: {
        status: "WON",
        estimatedValue: 550,
        stageChangedAt: expect.any(Date)
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

  describe("BOM link on quote items (R8)", () => {
    const baseDto = {
      projectId: "project-1",
      status: "DRAFT" as const,
      taxRate: 10,
      items: [{ name: "Máy dán nhãn", quantity: 2, unitPrice: 1000, bomId: "bom-9" }]
    };

    it("rejects a BOM that does not belong to the quote's project", async () => {
      tx.project.findFirst.mockResolvedValue({ id: "project-1", status: "SURVEY" });
      (tx as unknown as { bom: { count: jest.Mock } }).bom = { count: jest.fn().mockResolvedValue(0) };

      await expect(service.create(baseDto, user)).rejects.toThrow("BOM gắn vào hạng mục phải thuộc cùng dự án");
      expect(tx.quote.create).not.toHaveBeenCalled();
    });

    it("stores bomId on the item when the BOM belongs to the project", async () => {
      tx.project.findFirst.mockResolvedValue({ id: "project-1", status: "SURVEY" });
      (tx as unknown as { bom: { count: jest.Mock } }).bom = { count: jest.fn().mockResolvedValue(1) };
      tx.quote.aggregate.mockResolvedValue({ _max: { version: 0 } });
      tx.quote.findFirst.mockResolvedValue(null);
      tx.quote.create.mockResolvedValue({ id: "q1", quoteNo: "BG-1" });

      await service.create(baseDto, user);

      const data = tx.quote.create.mock.calls[0][0].data;
      expect(data.items.create[0]).toEqual(expect.objectContaining({ bomId: "bom-9", total: 2000 }));
    });

    it("returns an internal cost estimate per BOM line and for the whole quote", async () => {
      const quoteRow = {
        id: "q1", quoteNo: "BG-1", version: 1, status: "DRAFT", validUntil: null,
        subtotal: 3000, taxRate: 10, taxAmount: 300, total: 3300, tableColumnWidths: null,
        terms: null, deliveryTerms: null, internalNote: null, sentAt: null, acceptedAt: null,
        acceptedItemIds: [], createdAt: new Date(), updatedAt: new Date(),
        createdBy: { id: "u", name: "A", email: "a@a", role: "ADMIN" },
        project: {
          id: "p", code: "P", name: "P", status: "QUOTING", estimatedValue: 0, contract: null,
          customer: { id: "c", name: "C", shortName: null, taxCode: null, address: null, status: "ACTIVE", assignedTo: null, contacts: [] }
        },
        items: [
          { id: "i1", order: 1, name: "Máy", description: null, unit: null, quantity: 2, unitPrice: 1000, total: 2000, taxRate: 10, bomId: "bom-9" },
          { id: "i2", order: 2, name: "Dịch vụ", description: null, unit: null, quantity: 1, unitPrice: 1000, total: 1000, taxRate: 10, bomId: null }
        ]
      };
      jest.spyOn(service as unknown as { findAccessibleQuote: () => Promise<unknown> }, "findAccessibleQuote").mockResolvedValue(quoteRow);
      Object.assign(prisma, {
        bom: { findMany: jest.fn().mockResolvedValue([{ id: "bom-9", code: "BOM-1", name: "Máy", status: "APPROVED", version: 1 }]) },
        bomLine: {
          findMany: jest.fn().mockResolvedValue([
            { id: "l1", bomId: "bom-9", order: 0, group: "MECHANICAL", materialId: null, childBomId: null, name: "x", unit: null, quantity: 1, estUnitCost: 600, material: null }
          ])
        }
      });

      const detail = await service.findOne("q1", user);

      expect(detail.items[0].costEstimate).toEqual({ cost: 1200, margin: 800, marginPct: 40 });
      expect(detail.items[1].costEstimate).toBeNull();
      expect(detail.costEstimate).toEqual(
        expect.objectContaining({ cost: 1200, revenue: 2000, margin: 800, coveredItemCount: 1, itemCount: 2, isComplete: false })
      );
    });

    it.each([["quotes.view", "projects.view"], ["quotes.view", "projects.edit"]])("hides estimates unless both project view and edit permissions are granted (%s)", async (...permissions) => {
      const limited = { ...user, role: "STAFF" as never, permissions };
      jest.spyOn(service as unknown as { findAccessibleQuote: () => Promise<unknown> }, "findAccessibleQuote").mockResolvedValue({
        id: "q1", quoteNo: "BG-1", version: 1, status: "DRAFT", validUntil: null, subtotal: 0, taxRate: 10, taxAmount: 0, total: 0,
        tableColumnWidths: null, terms: null, deliveryTerms: null, internalNote: null, sentAt: null, acceptedAt: null,
        acceptedItemIds: [], createdAt: new Date(), updatedAt: new Date(), createdBy: null,
        project: { id: "p", code: "P", name: "P", status: "QUOTING", estimatedValue: 0, contract: null,
          customer: { id: "c", name: "C", shortName: null, taxCode: null, address: null, status: "ACTIVE", assignedTo: null, contacts: [] } },
        items: [{ id: "i1", order: 1, name: "Máy", description: null, unit: null, quantity: 1, unitPrice: 0, total: 0, taxRate: 10, bomId: "bom-9" }]
      });

      const detail = await service.findOne("q1", limited);
      expect(detail.costEstimate).toBeNull();
      expect(detail.items[0].costEstimate).toBeNull();
    });
  });

  describe("per-line VAT", () => {
    // Hand-computed: 10% group 2_500_010 -> 250_001; 8% group 999_999 + 1_000_001 = 2_000_000 -> 160_000;
    // 0% group 700_000 -> 0; KCT 500_000 -> 0. Subtotal 5_700_010, VAT 410_001, total 6_110_011.
    const mixedItems = [
      { name: "Dòng 8%", quantity: 3, unitPrice: 333_333, taxRate: 8 },
      { name: "Dòng mặc định", quantity: 2, unitPrice: 1_250_005 },
      { name: "Dòng KCT", quantity: 1, unitPrice: 500_000, taxRate: null },
      { name: "Dòng 0%", quantity: 1, unitPrice: 700_000, taxRate: 0 },
      { name: "Dòng 8.00%", quantity: 1, unitPrice: 1_000_001, taxRate: 8.0 }
    ];

    it("create persists resolved line rates and grouped totals", async () => {
      tx.project.findFirst.mockResolvedValue({ id: "project-1", status: "QUOTING" });
      tx.quote.aggregate.mockResolvedValue({ _max: { version: 0 } });
      tx.quote.findFirst.mockResolvedValue(null);
      tx.quote.create.mockResolvedValue({ id: "q1", quoteNo: "BG-1" });

      await service.create({ projectId: "project-1", status: "DRAFT", taxRate: 10, items: mixedItems }, user);

      const data = tx.quote.create.mock.calls[0][0].data;
      expect(data).toEqual(expect.objectContaining({ subtotal: 5_700_010, taxRate: 10, taxAmount: 410_001, total: 6_110_011 }));
      expect(data.items.create.map((item: { taxRate: number | null }) => item.taxRate)).toEqual([8, 10, null, 0, 8]);
    });

    it("update persists resolved line rates (omitted = quote default) and grouped totals", async () => {
      tx.quote.findFirst.mockResolvedValue({
        id: "q1", projectId: "project-1", status: "DRAFT", sentAt: null, acceptedAt: null,
        items: [], project: { id: "project-1", status: "QUOTING", contract: null }
      });
      tx.quote.update.mockResolvedValue({ id: "q1", quoteNo: "BG-1" });

      await service.update("q1", { projectId: "project-1", status: "DRAFT", taxRate: 5, items: [
        { name: "Mặc định 5%", quantity: 1, unitPrice: 1_010 },
        { name: "KCT", quantity: 1, unitPrice: 990, taxRate: null }
      ] }, user);

      const data = tx.quote.update.mock.calls[0][0].data;
      // 5% of 1_010 = 50.5 -> 51 (half-up); KCT adds nothing
      expect(data).toEqual(expect.objectContaining({ subtotal: 2_000, taxRate: 5, taxAmount: 51, total: 2_051 }));
      expect(data.items.create.map((item: { taxRate: number | null }) => item.taxRate)).toEqual([5, null]);
    });

    it("duplicate copies each line's rate instead of re-applying the quote default", async () => {
      tx.quote.findFirst
        .mockResolvedValueOnce({
          id: "q1", projectId: "project-1", taxRate: 10, validUntil: null, tableColumnWidths: null,
          terms: null, deliveryTerms: null, internalNote: null,
          items: [
            { name: "8%", description: null, unit: null, quantity: 1, unitPrice: 1_000, total: 1_000, taxRate: 8, bomId: null },
            { name: "KCT", description: null, unit: null, quantity: 1, unitPrice: 500, total: 500, taxRate: null, bomId: null }
          ],
          project: { id: "project-1", status: "QUOTING", contract: null }
        })
        .mockResolvedValueOnce(null);
      tx.quote.aggregate.mockResolvedValue({ _max: { version: 1 } });
      tx.quote.create.mockResolvedValue({ id: "q2", quoteNo: "BG-2", version: 2 });

      await service.duplicate("q1", user);

      const data = tx.quote.create.mock.calls[0][0].data;
      // Old single-rate logic would give 1_500 * 10% = 150 tax / 1_650 total.
      expect(data).toEqual(expect.objectContaining({ subtotal: 1_500, taxAmount: 80, total: 1_580 }));
      expect(data.items.create.map((item: { taxRate: number | null }) => item.taxRate)).toEqual([8, null]);
    });

    it("accepted subset total uses each accepted line's own rate", async () => {
      tx.quote.findFirst.mockResolvedValue({
        id: "quote-1", status: "SENT", sentAt: null, acceptedAt: null, total: 1_954, taxRate: 10, projectId: "project-1",
        items: [
          { id: "i1", total: 1_000, taxRate: 10 },
          { id: "i2", total: 500, taxRate: null },
          { id: "i3", total: 300, taxRate: 8 }
        ],
        project: { status: "NEGOTIATING", contract: null }
      });
      tx.quote.update.mockResolvedValue({ id: "quote-1", status: "ACCEPTED", sentAt: new Date(), acceptedAt: new Date() });

      await service.updateStatus("quote-1", { status: "ACCEPTED", acceptedItemIds: ["i2", "i3"] }, user);

      // 500 (KCT) + 300 + 24 = 824; the quote-level 10% would wrongly give 880.
      expect(tx.project.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ estimatedValue: 824 })
      }));
    });

    it("findOne returns line rates (KCT as null) and the tax breakdown", async () => {
      jest.spyOn(service as unknown as { findAccessibleQuote: () => Promise<unknown> }, "findAccessibleQuote").mockResolvedValue({
        id: "q1", quoteNo: "BG-1", version: 1, status: "DRAFT", validUntil: null, subtotal: 2_200, taxRate: 10, taxAmount: 180, total: 2_380,
        tableColumnWidths: null, terms: null, deliveryTerms: null, internalNote: null, sentAt: null, acceptedAt: null,
        acceptedItemIds: [], createdAt: new Date(), updatedAt: new Date(), createdBy: null,
        project: { id: "p", code: "P", name: "P", status: "QUOTING", estimatedValue: 0, contract: null,
          customer: { id: "c", name: "C", shortName: null, taxCode: null, address: null, status: "ACTIVE", assignedTo: null, contacts: [] } },
        items: [
          { id: "i1", order: 1, name: "KCT", description: null, unit: null, quantity: 1, unitPrice: 200, total: 200, taxRate: null, bomId: null },
          { id: "i2", order: 2, name: "8%", description: null, unit: null, quantity: 1, unitPrice: 1_000, total: 1_000, taxRate: 8, bomId: null },
          { id: "i3", order: 3, name: "10%", description: null, unit: null, quantity: 1, unitPrice: 1_000, total: 1_000, taxRate: 10, bomId: null }
        ]
      });

      const detail = await service.findOne("q1", { ...user, role: "STAFF" as never, permissions: ["quotes.view"] });

      expect(detail.items.map((item) => item.taxRate)).toEqual([null, 8, 10]);
      expect(detail.taxBreakdown).toEqual([
        { rate: 10, base: 1_000, tax: 100 },
        { rate: 8, base: 1_000, tax: 80 },
        { rate: null, base: 200, tax: 0 }
      ]);
    });
  });
});
