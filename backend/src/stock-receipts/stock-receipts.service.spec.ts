import { NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { StockReceiptsService } from "./stock-receipts.service";

describe("StockReceiptsService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: StockReceiptsService;
  let inventoryBalance: {
    adjustBalance: jest.Mock;
    updateAverageCostPrice: jest.Mock;
    ensureSufficientStock: jest.Mock;
  };
  let prisma: {
    $transaction: jest.Mock;
    stockReceipt: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
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
      stockReceipt: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new StockReceiptsService(
      prisma as unknown as PrismaService,
      inventoryBalance as unknown as InventoryBalanceService
    );
  });

  describe("create", () => {
    it("creates a DRAFT receipt with calculated totalAmount", async () => {
      // Mock the advisory lock and findFirst (for receiptNo generation), and create
      prisma.stockReceipt.findFirst.mockResolvedValue(null); // no previous receipt
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          stockReceipt: {
            ...prisma.stockReceipt,
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: "r1", receiptNo: "PN-2026-001" }),
          },
        };
        return fn(txMock);
      });

      const dto = {
        warehouseId: "wh-1",
        date: new Date(),
        items: [
          { materialId: "mat-1", quantity: 10, unitPrice: 50000 },
          { materialId: "mat-2", quantity: 5, unitPrice: 100000 },
        ],
      };

      const result = await service.create(dto, user);

      expect(result.receiptNo).toBe("PN-2026-001");
    });
  });

  describe("confirm", () => {
    it("calls adjustBalance and updateAverageCostPrice for each item", async () => {
      const receipt = {
        id: "r1",
        warehouseId: "wh-1",
        status: "DRAFT",
        items: [
          { materialId: "mat-1", quantity: new Decimal(10), unitPrice: new Decimal(50000) },
          { materialId: "mat-2", quantity: new Decimal(5), unitPrice: new Decimal(100000) },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockReceipt: {
            ...prisma.stockReceipt,
            findFirst: jest.fn().mockResolvedValue(receipt),
            update: jest.fn().mockResolvedValue({ id: "r1", receiptNo: "PN-2026-001", status: "CONFIRMED", confirmedAt: new Date() }),
          },
        };
        return fn(txMock);
      });

      await service.confirm("r1", user);

      expect(inventoryBalance.adjustBalance).toHaveBeenCalledTimes(2);
      expect(inventoryBalance.updateAverageCostPrice).toHaveBeenCalledTimes(2);
    });

    it("throws NotFoundException when receipt not in DRAFT", async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockReceipt: {
            ...prisma.stockReceipt,
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(txMock);
      });

      await expect(service.confirm("r-confirmed", user)).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancel", () => {
    it("sets status to CANCELLED", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue({ id: "r1", status: "DRAFT" });
      prisma.stockReceipt.update.mockResolvedValue({ id: "r1", receiptNo: "PN-2026-001", status: "CANCELLED" });

      const result = await service.cancel("r1", user);

      expect(result.status).toBe("CANCELLED");
    });

    it("throws NotFoundException when receipt not in DRAFT", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(null);

      await expect(service.cancel("r-confirmed", user)).rejects.toThrow(NotFoundException);
    });
  });
});
