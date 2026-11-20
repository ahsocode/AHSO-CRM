import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { StockReceiptsService } from "./stock-receipts.service";

type Mock = jest.Mock;

describe("StockReceiptsService - confirm / cancel / review controls", () => {
  const admin = { sub: "admin-1", email: "a@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  const staff = { sub: "staff-1", email: "s@ahso.vn", name: "Staff", role: "STAFF" as const, permissions: ["inventory.edit"] };

  let service: StockReceiptsService;
  let audit: { record: Mock };
  let balance: { adjustBalance: Mock; updateAverageCostPrice: Mock; ensureSufficientStock: Mock };
  let prisma: {
    $transaction: Mock;
    stockReceipt: { findFirst: Mock; update: Mock; updateMany: Mock };
    stockLot: { create: Mock; findMany: Mock; update: Mock };
    stockBalance: { findMany: Mock };
    stockReceiptItem: { findUnique: Mock };
    material: { findUnique: Mock; update: Mock };
    receiptPendingLine: { findMany: Mock };
    projectCost: { updateMany: Mock };
    setting: { findUnique: Mock };
  };

  const draft = (over: Record<string, unknown> = {}) => ({
    id: "r1",
    receiptNo: "PN-2026-001",
    warehouseId: "wh-1",
    date: new Date("2026-11-10T00:00:00.000Z"),
    invoiceDate: new Date("2026-11-09T00:00:00.000Z"),
    purchaseInvoiceNo: "C26TAA-1",
    invoiceNumber: "1",
    status: "DRAFT",
    receiptType: "PURCHASE",
    reviewStatus: null,
    supplier: null,
    _count: { pendingLines: 0 },
    items: [{ id: "i1", materialId: "m1", quantity: new Decimal(2), unitPrice: new Decimal(1000), valueAdjustment: null, projectId: null }],
    ...over
  });

  beforeEach(() => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    balance = {
      adjustBalance: jest.fn().mockResolvedValue(undefined),
      updateAverageCostPrice: jest.fn().mockResolvedValue(undefined),
      ensureSufficientStock: jest.fn().mockResolvedValue(undefined)
    };
    prisma = {
      $transaction: jest.fn(),
      stockReceipt: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: "r1", receiptNo: "PN-2026-001", status: "CONFIRMED", confirmedAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      stockLot: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      stockBalance: { findMany: jest.fn().mockResolvedValue([]) },
      stockReceiptItem: { findUnique: jest.fn() },
      material: { findUnique: jest.fn(), update: jest.fn() },
      receiptPendingLine: { findMany: jest.fn().mockResolvedValue([]) },
      projectCost: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      setting: { findUnique: jest.fn().mockResolvedValue(null) }
    };
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: typeof prisma) => unknown)(prisma)
    );
    service = new StockReceiptsService(
      prisma as unknown as PrismaService,
      balance as unknown as InventoryBalanceService,
      audit as unknown as AuditService
    );
  });

  describe("confirm", () => {
    it("rejects users without inventory.approve before touching the database", async () => {
      await expect(service.confirm("r1", staff)).rejects.toThrow(ForbiddenException);
      expect(prisma.stockReceipt.findFirst).not.toHaveBeenCalled();
    });

    it("rejects a receipt that is still PENDING_REVIEW", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(draft({ reviewStatus: "PENDING_REVIEW" }));
      await expect(service.confirm("r1", admin)).rejects.toThrow(/chờ duyệt/);
      expect(balance.adjustBalance).not.toHaveBeenCalled();
    });

    it("rejects a receipt that still has pending (unmatched) lines and lists them", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(draft({ _count: { pendingLines: 1 } }));
      prisma.receiptPendingLine.findMany.mockResolvedValue([{ lineNo: 3, supplierItemName: "Bulong M8" }]);
      await expect(service.confirm("r1", admin)).rejects.toThrow(/#3 Bulong M8/);
    });

    it("rejects a purchase receipt without invoice info", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(draft({ invoiceNumber: null, purchaseInvoiceNo: null }));
      await expect(service.confirm("r1", admin)).rejects.toThrow(/thiếu thông tin hóa đơn/);
    });

    it("rejects when the period is locked (uses the earlier of receipt/invoice date)", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(draft());
      prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2026-11-09") });
      await expect(service.confirm("r1", admin)).rejects.toThrow(/khóa/);
      expect(balance.adjustBalance).not.toHaveBeenCalled();
    });

    it("confirms a reviewed receipt, creates lots and records audit", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(draft({ reviewStatus: "REVIEWED" }));
      const result = await service.confirm("r1", admin);
      expect(result.status).toBe("CONFIRMED");
      expect(balance.adjustBalance).toHaveBeenCalledTimes(1);
      expect(prisma.stockLot.create).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "confirm", resourceId: "r1" }));
    });

    it("ADJUSTMENT: price-only line moves costPrice by delta / stock, never creates a lot", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(
        draft({
          receiptType: "ADJUSTMENT",
          items: [{ id: "i1", materialId: "m1", quantity: new Decimal(0), unitPrice: new Decimal(0), valueAdjustment: new Decimal(1000), projectId: null }]
        })
      );
      prisma.stockBalance.findMany.mockResolvedValue([{ quantity: new Decimal(10) }]);
      prisma.material.findUnique.mockResolvedValue({ costPrice: new Decimal(500) });
      await service.confirm("r1", admin);
      // (10 * 500 + 1000) / 10 = 600
      expect(prisma.material.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { costPrice: new Decimal(600) } });
      expect(prisma.stockLot.create).not.toHaveBeenCalled();
      expect(balance.adjustBalance).not.toHaveBeenCalled();
    });

    it("ADJUSTMENT: price-only line with zero stock is skipped with a warning", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(
        draft({
          receiptType: "ADJUSTMENT",
          items: [{ id: "i1", materialId: "m1", quantity: new Decimal(0), unitPrice: new Decimal(0), valueAdjustment: new Decimal(1000), projectId: null }]
        })
      );
      const result = (await service.confirm("r1", admin)) as { warnings?: string[] };
      expect(prisma.material.update).not.toHaveBeenCalled();
      expect(result.warnings?.[0]).toMatch(/Tồn kho bằng 0/);
    });

    it("ADJUSTMENT: negative quantity needs stock and reduces lots FIFO", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(
        draft({
          receiptType: "ADJUSTMENT",
          items: [{ id: "i1", materialId: "m1", quantity: new Decimal(-3), unitPrice: new Decimal(1000), valueAdjustment: null, projectId: null }]
        })
      );
      prisma.stockLot.findMany.mockResolvedValue([
        { id: "lot1", remainingQuantity: new Decimal(2) },
        { id: "lot2", remainingQuantity: new Decimal(5) }
      ]);
      await service.confirm("r1", admin);
      expect(balance.ensureSufficientStock).toHaveBeenCalledWith(prisma, "wh-1", "m1", new Decimal(3));
      expect(balance.adjustBalance).toHaveBeenCalledWith(prisma, "wh-1", "m1", new Decimal(-3));
      expect(prisma.stockLot.update).toHaveBeenNthCalledWith(1, { where: { id: "lot1" }, data: { remainingQuantity: { decrement: new Decimal(2) } } });
      expect(prisma.stockLot.update).toHaveBeenNthCalledWith(2, { where: { id: "lot2" }, data: { remainingQuantity: { decrement: new Decimal(1) } } });
    });
  });

  describe("cancel", () => {
    it("requires inventory.approve and an open period", async () => {
      await expect(service.cancel("r1", staff)).rejects.toThrow(ForbiddenException);
      prisma.stockReceipt.findFirst.mockResolvedValue(draft());
      prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2026-12-31") });
      await expect(service.cancel("r1", admin)).rejects.toThrow(BadRequestException);
    });

    it("soft-deletes the expense lines of the receipt so the invoice can be re-submitted", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue(draft());
      prisma.stockReceipt.update.mockResolvedValue({ id: "r1", receiptNo: "PN-2026-001", status: "CANCELLED" });
      await service.cancel("r1", admin);
      expect(prisma.projectCost.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { receiptId: "r1", deletedAt: null } })
      );
    });
  });

  describe("review", () => {
    it("requires inventory.approve", async () => {
      await expect(service.review("r1", undefined, staff)).rejects.toThrow(ForbiddenException);
    });

    it("moves PENDING_REVIEW to REVIEWED, signs off expense lines, writes audit", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue({ id: "r1", receiptNo: "PN-2026-001", status: "DRAFT", reviewStatus: "PENDING_REVIEW" });
      const result = await service.review("r1", "ok", admin);
      expect(result.reviewStatus).toBe("REVIEWED");
      expect(prisma.stockReceipt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "r1", reviewStatus: "PENDING_REVIEW" }, data: expect.objectContaining({ reviewStatus: "REVIEWED", reviewedById: "admin-1" }) })
      );
      expect(prisma.projectCost.updateMany).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "review", changes: expect.objectContaining({ note: "ok" }) }));
    });

    it("refuses a second review and receipts that are not pending", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue({ id: "r1", receiptNo: "x", status: "DRAFT", reviewStatus: "REVIEWED" });
      await expect(service.review("r1", undefined, admin)).rejects.toThrow(ConflictException);
      prisma.stockReceipt.findFirst.mockResolvedValue({ id: "r1", receiptNo: "x", status: "DRAFT", reviewStatus: null });
      await expect(service.review("r1", undefined, admin)).rejects.toThrow(BadRequestException);
    });

    it("loses gracefully when a concurrent reviewer wins", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue({ id: "r1", receiptNo: "x", status: "DRAFT", reviewStatus: "PENDING_REVIEW" });
      prisma.stockReceipt.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.review("r1", undefined, admin)).rejects.toThrow(ConflictException);
    });
  });
});
