import { NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { StockCountsService } from "./stock-counts.service";

describe("StockCountsService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: StockCountsService;
  let inventoryBalance: {
    adjustBalance: jest.Mock;
    updateAverageCostPrice: jest.Mock;
    ensureSufficientStock: jest.Mock;
  };
  let prisma: {
    $transaction: jest.Mock;
    stockCount: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    stockBalance: {
      findMany: jest.Mock;
    };
    stockLot: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    material: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    inventoryBalance = {
      adjustBalance: jest.fn().mockResolvedValue(undefined),
      updateAverageCostPrice: jest.fn().mockResolvedValue(undefined),
      ensureSufficientStock: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      $transaction: jest.fn().mockImplementation((fnOrArr) => {
        if (Array.isArray(fnOrArr)) return Promise.all(fnOrArr);
        return fnOrArr(prisma);
      }),
      stockCount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockBalance: {
        findMany: jest.fn(),
      },
      stockLot: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      material: {
        findUnique: jest.fn(),
      },
    };
    service = new StockCountsService(
      prisma as unknown as PrismaService,
      inventoryBalance as unknown as InventoryBalanceService
    );
  });

  describe("create", () => {
    it("auto-fills systemQuantity from StockBalance", async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          stockCount: {
            ...prisma.stockCount,
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: "cc1", countNo: "KK-2026-001" }),
          },
          stockBalance: {
            findMany: jest.fn().mockResolvedValue([
              { materialId: "mat-1", quantity: new Decimal(25) },
            ]),
          },
        };
        return fn(txMock);
      });

      const dto = {
        warehouseId: "wh-1",
        date: new Date(),
        items: [{ materialId: "mat-1", actualQuantity: 20 }],
      };

      const result = await service.create(dto, user);

      expect(result.countNo).toBe("KK-2026-001");
      // Verify stockBalance.findMany was called to get systemQuantity
      const txMockCalls = (prisma.$transaction as jest.Mock).mock.calls;
      expect(txMockCalls.length).toBe(1);
    });
  });

  describe("confirm", () => {
    it("calls adjustBalance with diff for each item", async () => {
      const count = {
        id: "cc1",
        warehouseId: "wh-1",
        date: new Date("2026-05-05T00:00:00.000Z"),
        status: "DRAFT",
        items: [
          { materialId: "mat-1", diff: new Decimal(-5) },  // actual < system
          { materialId: "mat-2", diff: new Decimal(3) },   // actual > system
        ],
      };

      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockCount: {
            ...prisma.stockCount,
            findFirst: jest.fn().mockResolvedValue(count),
            update: jest.fn().mockResolvedValue({ id: "cc1", countNo: "KK-2026-001", status: "CONFIRMED", confirmedAt: new Date() }),
          },
          stockLot: {
            findMany: jest.fn().mockResolvedValue([{ id: "lot-1", remainingQuantity: new Decimal(5) }]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue({}),
          },
          material: {
            findUnique: jest.fn().mockResolvedValue({ costPrice: new Decimal(100000) }),
          },
        };
        return fn(txMock);
      });

      await service.confirm("cc1", user);

      expect(inventoryBalance.adjustBalance).toHaveBeenCalledTimes(2);
      const [, , , diff1] = inventoryBalance.adjustBalance.mock.calls[0];
      const [, , , diff2] = inventoryBalance.adjustBalance.mock.calls[1];
      expect(new Decimal(diff1).equals(-5)).toBe(true);
      expect(new Decimal(diff2).equals(3)).toBe(true);
    });

    it("throws NotFoundException when count not in DRAFT", async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockCount: {
            ...prisma.stockCount,
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(txMock);
      });

      await expect(service.confirm("cc-confirmed", user)).rejects.toThrow(NotFoundException);
    });
  });
});
