import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { StockTransfersService } from "./stock-transfers.service";

describe("StockTransfersService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: StockTransfersService;
  let inventoryBalance: {
    adjustBalance: jest.Mock;
    updateAverageCostPrice: jest.Mock;
    ensureSufficientStock: jest.Mock;
  };
  let prisma: {
    $transaction: jest.Mock;
    stockTransfer: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    stockLot: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
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
      stockTransfer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockLot: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new StockTransfersService(
      prisma as unknown as PrismaService,
      inventoryBalance as unknown as InventoryBalanceService
    );
  });

  describe("create", () => {
    it("throws BadRequestException when fromWarehouseId equals toWarehouseId", async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          stockTransfer: {
            ...prisma.stockTransfer,
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        };
        return fn(txMock);
      });

      const dto = {
        fromWarehouseId: "wh-1",
        toWarehouseId: "wh-1",
        date: new Date(),
        items: [{ materialId: "mat-1", quantity: 5 }],
      };

      await expect(service.create(dto, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe("confirm", () => {
    it("calls ensureSufficientStock on from-warehouse and adjustBalance on both warehouses", async () => {
      const transfer = {
        id: "t1",
        fromWarehouseId: "wh-from",
        toWarehouseId: "wh-to",
        date: new Date("2026-05-05T00:00:00.000Z"),
        status: "DRAFT",
        items: [
          { materialId: "mat-1", quantity: new Decimal(10) },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockTransfer: {
            ...prisma.stockTransfer,
            findFirst: jest.fn().mockResolvedValue(transfer),
            update: jest.fn().mockResolvedValue({ id: "t1", transferNo: "PCT-2026-001", status: "CONFIRMED", confirmedAt: new Date() }),
          },
          stockLot: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: "lot-1",
                stockReceiptItemId: "ri-1",
                purchaseInvoiceDate: new Date("2026-05-01T00:00:00.000Z"),
                purchaseInvoiceNo: "HDM-001",
                remainingQuantity: new Decimal(10),
                unitPrice: new Decimal(50000),
              },
            ]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(txMock);
      });

      await service.confirm("t1", user);

      expect(inventoryBalance.ensureSufficientStock).toHaveBeenCalledWith(
        expect.anything(), "wh-from", "mat-1", new Decimal(10)
      );
      // adjustBalance called twice: decrease from-warehouse, increase to-warehouse
      expect(inventoryBalance.adjustBalance).toHaveBeenCalledTimes(2);
      const [, fromWh, , fromDelta] = inventoryBalance.adjustBalance.mock.calls[0];
      const [, toWh, , toDelta] = inventoryBalance.adjustBalance.mock.calls[1];
      expect(fromWh).toBe("wh-from");
      expect(new Decimal(fromDelta).equals(-10)).toBe(true);
      expect(toWh).toBe("wh-to");
      expect(new Decimal(toDelta).equals(10)).toBe(true);
    });

    it("throws NotFoundException when transfer not in DRAFT", async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockTransfer: {
            ...prisma.stockTransfer,
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(txMock);
      });

      await expect(service.confirm("t-confirmed", user)).rejects.toThrow(NotFoundException);
    });
  });
});
