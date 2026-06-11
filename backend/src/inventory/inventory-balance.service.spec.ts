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
