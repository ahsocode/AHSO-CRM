import { NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { StockIssuesService } from "./stock-issues.service";

describe("StockIssuesService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: StockIssuesService;
  let inventoryBalance: {
    adjustBalance: jest.Mock;
    updateAverageCostPrice: jest.Mock;
    ensureSufficientStock: jest.Mock;
    consumeStockLots: jest.Mock;
  };
  let prisma: {
    $transaction: jest.Mock;
    stockIssue: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    stockLot: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    inventoryBalance = {
      adjustBalance: jest.fn().mockResolvedValue(undefined),
      updateAverageCostPrice: jest.fn().mockResolvedValue(undefined),
      ensureSufficientStock: jest.fn().mockResolvedValue(undefined),
      consumeStockLots: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      $transaction: jest.fn().mockImplementation((fnOrArr) => {
        if (Array.isArray(fnOrArr)) return Promise.all(fnOrArr);
        return fnOrArr(prisma);
      }),
      stockIssue: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockLot: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new StockIssuesService(
      prisma as unknown as PrismaService,
      inventoryBalance as unknown as InventoryBalanceService
    );
  });

  describe("confirm", () => {
    it("calls ensureSufficientStock then adjustBalance with negated qty for each item", async () => {
      const issue = {
        id: "i1",
        warehouseId: "wh-1",
        date: new Date("2026-05-05T00:00:00.000Z"),
        status: "DRAFT",
        items: [
          { materialId: "mat-1", quantity: new Decimal(8), unitPrice: new Decimal(50000) },
        ],
      };

      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockIssue: {
            ...prisma.stockIssue,
            findFirst: jest.fn().mockResolvedValue(issue),
            update: jest.fn().mockResolvedValue({ id: "i1", issueNo: "PX-2026-001", status: "CONFIRMED", confirmedAt: new Date() }),
          },
          stockLot: {
            findMany: jest.fn().mockResolvedValue([{ id: "lot-1", remainingQuantity: new Decimal(8) }]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return fn(txMock);
      });

      await service.confirm("i1", user);

      expect(inventoryBalance.ensureSufficientStock).toHaveBeenCalledWith(
        expect.anything(), "wh-1", "mat-1", new Decimal(8)
      );
      // adjustBalance called with negated quantity
      const [, , , delta] = inventoryBalance.adjustBalance.mock.calls[0];
      expect(new Decimal(delta).equals(-8)).toBe(true);
    });

    it("throws NotFoundException when issue not in DRAFT", async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          ...prisma,
          stockIssue: {
            ...prisma.stockIssue,
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(txMock);
      });

      await expect(service.confirm("i-confirmed", user)).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancel", () => {
    it("sets status to CANCELLED", async () => {
      prisma.stockIssue.findFirst.mockResolvedValue({ id: "i1", status: "DRAFT" });
      prisma.stockIssue.update.mockResolvedValue({ id: "i1", issueNo: "PX-2026-001", status: "CANCELLED" });

      const result = await service.cancel("i1", user);

      expect(result.status).toBe("CANCELLED");
    });
  });
});
