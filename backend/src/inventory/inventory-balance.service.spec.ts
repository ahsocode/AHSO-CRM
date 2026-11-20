import { BadRequestException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "./inventory-balance.service";

describe("InventoryBalanceService", () => {
  let service: InventoryBalanceService;
  let prisma: {
    $transaction: jest.Mock;
    stockBalance: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    material: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  // Shared tx mock — same object as prisma for simplicity
  let tx: typeof prisma;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
      stockBalance: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      material: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    tx = prisma; // pass prisma as the tx arg
    service = new InventoryBalanceService(prisma as unknown as PrismaService);
  });

  describe("adjustBalance", () => {
    it("upserts with the given delta", async () => {
      prisma.stockBalance.upsert.mockResolvedValue({});

      await service.adjustBalance(tx as any, "wh-1", "mat-1", 10);

      expect(prisma.stockBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId_materialId: { warehouseId: "wh-1", materialId: "mat-1" } },
          create: expect.objectContaining({ quantity: new Decimal(10) }),
          update: expect.objectContaining({ quantity: { increment: new Decimal(10) } }),
        })
      );
    });

    it("uses conditional updateMany for negative delta (for stock reduction)", async () => {
      prisma.stockBalance.updateMany.mockResolvedValue({ count: 1 });

      await service.adjustBalance(tx as any, "wh-1", "mat-1", -5);

      expect(prisma.stockBalance.updateMany).toHaveBeenCalledWith({
        where: {
          warehouseId: "wh-1",
          materialId: "mat-1",
          quantity: { gte: new Decimal(5) },
        },
        data: { quantity: { increment: new Decimal(-5) } },
      });
      expect(prisma.stockBalance.upsert).not.toHaveBeenCalled();
    });

    it("throws when conditional stock reduction loses the race", async () => {
      prisma.stockBalance.updateMany.mockResolvedValue({ count: 0 });
      prisma.material.findUnique.mockResolvedValue({ name: "Cáp điện" });

      await expect(service.adjustBalance(tx as any, "wh-1", "mat-1", -5)).rejects.toThrow(BadRequestException);
    });
  });

  describe("ensureSufficientStock", () => {
    it("does not throw when balance is sufficient", async () => {
      prisma.stockBalance.findUnique.mockResolvedValue({ quantity: new Decimal(20) });

      await expect(service.ensureSufficientStock(tx as any, "wh-1", "mat-1", 10)).resolves.toBeUndefined();
    });

    it("throws BadRequestException when balance is insufficient", async () => {
      prisma.stockBalance.findUnique.mockResolvedValue({ quantity: new Decimal(3) });
      prisma.material.findUnique.mockResolvedValue({ name: "Cáp điện" });

      await expect(service.ensureSufficientStock(tx as any, "wh-1", "mat-1", 10)).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws when no balance record exists", async () => {
      prisma.stockBalance.findUnique.mockResolvedValue(null);
      prisma.material.findUnique.mockResolvedValue({ name: "Cáp điện" });

      await expect(service.ensureSufficientStock(tx as any, "wh-1", "mat-1", 1)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("updateAverageCostPrice", () => {
    it("computes weighted average and updates costPrice", async () => {
      // Existing stock: 100 units at 40,000 VND (cost); adding 50 units at 60,000 VND
      // After adjustBalance ran, totalAfter = 150, stockBefore = 100
      // avgNew = (100*40000 + 50*60000) / 150 = 46667
      prisma.material.findUnique.mockResolvedValue({ costPrice: new Decimal(40000) });
      prisma.stockBalance.findMany.mockResolvedValue([
        { quantity: new Decimal(150) }, // total after the receipt was added
      ]);
      prisma.material.update.mockResolvedValue({});

      await service.updateAverageCostPrice(tx as any, "mat-1", 50, 60000);

      expect(prisma.material.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "mat-1" },
          data: expect.objectContaining({ costPrice: expect.any(Decimal) }),
        })
      );

      const newCost = prisma.material.update.mock.calls[0][0].data.costPrice;
      expect(Number(newCost)).toBe(46667);
    });

    it("uses newUnitPrice when there is no prior stock", async () => {
      prisma.material.findUnique.mockResolvedValue({ costPrice: new Decimal(0) });
      prisma.stockBalance.findMany.mockResolvedValue([{ quantity: new Decimal(10) }]);
      prisma.material.update.mockResolvedValue({});

      await service.updateAverageCostPrice(tx as any, "mat-1", 10, 55000);

      const newCost = prisma.material.update.mock.calls[0][0].data.costPrice;
      // stockBefore = 10 - 10 = 0 → newAvg = 0*cost + 10*55000 / 10 = 55000
      expect(Number(newCost)).toBe(55000);
    });

    it("does nothing when material is not found", async () => {
      prisma.material.findUnique.mockResolvedValue(null);

      await service.updateAverageCostPrice(tx as any, "mat-missing", 10, 50000);

      expect(prisma.material.update).not.toHaveBeenCalled();
    });
  });
});

describe("InventoryBalanceService - project-tagged lots", () => {
  const { Decimal: Dec } = jest.requireActual("@prisma/client/runtime/library");
  const date = new Date("2026-11-20T00:00:00.000Z");

  // Minimal in-memory stockLot table honouring the where-clause used by consumeStockLots.
  type Lot = { id: string; projectId: string | null; remainingQuantity: InstanceType<typeof Dec>; purchaseInvoiceDate: Date; createdAt: Date };
  function setup(lots: Lot[]) {
    const matches = (lot: Lot, where: Record<string, unknown>): boolean => {
      if ("projectId" in where && where["projectId"] !== undefined && (where["projectId"] as unknown) !== lot.projectId) return false;
      const or = where["OR"] as Array<{ projectId: string | null }> | undefined;
      if (or && !or.some((c) => c.projectId === lot.projectId)) return false;
      return true;
    };
    const tx = {
      stockLot: {
        findMany: jest.fn().mockImplementation(async ({ where }) =>
          lots
            .filter((l) => matches(l, where))
            .sort((a, b) => a.purchaseInvoiceDate.getTime() - b.purchaseInvoiceDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime())
        ),
        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          const lot = lots.find((l) => l.id === where.id)!;
          lot.remainingQuantity = lot.remainingQuantity.minus(data.remainingQuantity.decrement);
          return { count: 1 };
        }),
      },
    };
    const service = new InventoryBalanceService({} as unknown as PrismaService);
    return { tx, service, lots };
  }
  const lot = (id: string, projectId: string | null, qty: number, day: number): Lot => ({
    id, projectId, remainingQuantity: new Dec(qty), purchaseInvoiceDate: new Date(Date.UTC(2026, 9, day)), createdAt: new Date(Date.UTC(2026, 9, day)),
  });
  const remaining = (lots: Lot[], id: string) => lots.find((l) => l.id === id)!.remainingQuantity.toNumber();

  it("issue for project A never takes project B's lot", async () => {
    const { tx, service, lots } = setup([lot("B1", "B", 10, 1), lot("C1", null, 3, 2)]);

    await expect(service.consumeStockLots(tx as never, "wh", "m", new Dec(5), date, { projectId: "A" })).rejects.toThrow();
    // only the common lot was a candidate (3 < 5) and B's lot is untouched
    expect(remaining(lots, "B1")).toBe(10);
  });

  it("prefers project A's lots first, then common lots, even if the common lot is older", async () => {
    const { tx, service, lots } = setup([lot("C1", null, 10, 1), lot("A1", "A", 4, 5), lot("B1", "B", 10, 2)]);

    await service.consumeStockLots(tx as never, "wh", "m", new Dec(6), date, { projectId: "A" });

    expect(remaining(lots, "A1")).toBe(0); // 4 from A
    expect(remaining(lots, "C1")).toBe(8); // 2 from common
    expect(remaining(lots, "B1")).toBe(10);
  });

  it("issue that is not for a project (projectId null) takes common lots only", async () => {
    const { tx, service, lots } = setup([lot("A1", "A", 10, 1), lot("C1", null, 5, 2)]);

    await service.consumeStockLots(tx as never, "wh", "m", new Dec(5), date, { projectId: null });

    expect(remaining(lots, "A1")).toBe(10);
    expect(remaining(lots, "C1")).toBe(0);
  });

  it("legacy call without options keeps the old behaviour (oldest lot first, any lot)", async () => {
    const { tx, service, lots } = setup([lot("A1", "A", 4, 1), lot("C1", null, 5, 2)]);

    await service.consumeStockLots(tx as never, "wh", "m", new Dec(6), date);

    expect(remaining(lots, "A1")).toBe(0);
    expect(remaining(lots, "C1")).toBe(3);
  });
});

describe("InventoryBalanceService.findBalances with projectId", () => {
  it("returns the sum of remainingQuantity of lots tagged with that project", async () => {
    const { Decimal: Dec } = jest.requireActual("@prisma/client/runtime/library");
    const prisma = {
      stockLot: {
        groupBy: jest.fn().mockResolvedValue([{ warehouseId: "wh", materialId: "m1", _sum: { remainingQuantity: new Dec(7) } }]),
      },
      warehouse: { findMany: jest.fn().mockResolvedValue([{ id: "wh", name: "Kho", code: "K1" }]) },
      material: {
        findMany: jest.fn().mockResolvedValue([{ id: "m1", name: "Cáp", code: "C1", unit: "m", minStock: null, costPrice: new Dec(1000) }]),
      },
      stockBalance: { findMany: jest.fn() },
    };
    const service = new InventoryBalanceService(prisma as unknown as PrismaService);

    const result = await service.findBalances({ page: 1, limit: 10, projectId: "A" });

    expect(prisma.stockLot.groupBy.mock.calls[0][0].where).toMatchObject({ projectId: "A", remainingQuantity: { gt: 0 } });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ quantity: 7, value: 7000, warehouseId: "wh", materialId: "m1" });
    expect(prisma.stockBalance.findMany).not.toHaveBeenCalled();
  });
});
