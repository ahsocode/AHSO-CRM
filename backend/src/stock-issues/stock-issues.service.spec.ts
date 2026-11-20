import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { FakeInventoryDb } from "./stock-issues.fake-db";
import { StockIssuesService } from "./stock-issues.service";

describe("StockIssuesService (costing, cancel with reversal)", () => {
  const admin = { sub: "admin-1", email: "a@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  const staff = { sub: "staff-1", email: "s@ahso.vn", name: "Staff", role: "STAFF" as const, permissions: ["inventory.edit"] };
  const issueDate = new Date("2026-11-20T00:00:00.000Z");
  const day = (d: number) => new Date(Date.UTC(2026, 9, d)); // October 2026

  let db: FakeInventoryDb;
  let balance: InventoryBalanceService;
  let audit: { record: jest.Mock };
  let service: StockIssuesService;

  beforeEach(() => {
    db = new FakeInventoryDb();
    db.addMaterial("m1");
    balance = new InventoryBalanceService({} as unknown as PrismaService);
    audit = { record: jest.fn().mockResolvedValue({}) };
    service = new StockIssuesService(db as never, balance, audit as unknown as AuditService);
  });

  /** Simulates a confirmed purchase receipt: new lot + balance + moving average (same primitives the receipt service uses). */
  async function receive(qty: number, price: number, invoiceDay: number, projectId: string | null = null, materialId = "m1") {
    const id = `lot-${db.lots.length + 1}`;
    db.lots.push({
      id, warehouseId: "wh", materialId, purchaseInvoiceDate: day(invoiceDay), receivedQuantity: new Decimal(qty),
      remainingQuantity: new Decimal(qty), unitPrice: new Decimal(price), projectId, createdAt: day(invoiceDay),
    });
    await balance.adjustBalance(db as never, "wh", materialId, qty);
    await balance.updateAverageCostPrice(db as never, materialId, qty, price);
    return id;
  }

  async function issueAndConfirm(id: string, qty: number, extra: Partial<Parameters<FakeInventoryDb["addIssue"]>[0]> = {}) {
    db.addIssue({ id, items: [{ materialId: "m1", quantity: qty }], date: issueDate, ...extra });
    return service.confirm(id, admin);
  }

  describe("confirm pricing", () => {
    it("AVERAGE: 10x100k + 10x140k -> costPrice 120k; issue 5 = 600k, costPrice unchanged; +5x180k -> 135k", async () => {
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);
      expect(db.costPrice("m1")).toBe(120000);

      const result = await issueAndConfirm("i1", 5);

      expect(result.costingMethod).toBe("AVERAGE");
      expect(result.items[0]).toMatchObject({ unitPrice: 120000, total: 600000 });
      expect(result.totalAmount).toBe(600000);
      expect(db.costPrice("m1")).toBe(120000); // an issue never changes the moving average
      expect(db.stock("m1")).toBe(15);

      await receive(5, 180000, 3);
      expect(db.costPrice("m1")).toBe(135000); // (15x120k + 5x180k) / 20
      expect(db.stock("m1")).toBe(20);
    });

    it("AVERAGE still records the FIFO lot consumption (traceability) at the lot price", async () => {
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);
      await issueAndConfirm("i1", 12);

      expect(db.consumptions.map((c) => [c.stockLotId, c.quantity.toNumber(), c.lotUnitPrice.toNumber()])).toEqual([
        ["lot-1", 10, 100000],
        ["lot-2", 2, 140000],
      ]);
      expect(db.items[0].total.toNumber()).toBe(1440000); // 12 x 120k, not the lot value
    });

    it("FIFO: issue 12 = 10x100k + 2x140k = 1,280,000 (avg 106,667) with 2 lot rows", async () => {
      db.costingConfigs.push({ method: "FIFO", effectiveFrom: new Date("2026-01-01T00:00:00.000Z") });
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);

      const result = await issueAndConfirm("i1", 12);

      expect(result.costingMethod).toBe("FIFO");
      expect(result.items[0]).toMatchObject({ unitPrice: 106667, total: 1280000 });
      expect(result.totalAmount).toBe(1280000);
      expect(db.consumptions).toHaveLength(2);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(0);
      expect(db.lot("lot-2").remainingQuantity.toNumber()).toBe(8);
    });

    it("uses the method in force on the issue date (config effective from a later date does not apply earlier)", async () => {
      db.costingConfigs.push({ method: "FIFO", effectiveFrom: new Date("2027-01-01T00:00:00.000Z") });
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);
      const result = await issueAndConfirm("i1", 12);
      expect(result.costingMethod).toBe("AVERAGE");
    });

    it("never allows negative stock", async () => {
      await receive(3, 100000, 1);
      db.addIssue({ id: "i1", items: [{ materialId: "m1", quantity: 5 }], date: issueDate });
      await expect(service.confirm("i1", admin)).rejects.toThrow(/Không đủ tồn kho/);
      expect(db.stock("m1")).toBe(3);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(3);
    });

    it("requires inventory.approve to confirm and respects the period lock", async () => {
      await receive(10, 100000, 1);
      db.addIssue({ id: "i1", items: [{ materialId: "m1", quantity: 1 }], date: issueDate });
      await expect(service.confirm("i1", staff)).rejects.toThrow(ForbiddenException);

      db.settings.set("inventory.periodLockedUntil", JSON.stringify("2026-11-30"));
      await expect(service.confirm("i1", admin)).rejects.toThrow(/khóa/);
      expect(db.stock("m1")).toBe(10);
    });

    it("throws NotFoundException when the issue is not a DRAFT", async () => {
      db.addIssue({ id: "i1", items: [], status: "CONFIRMED" });
      await expect(service.confirm("i1", admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe("purchase-invoice date vs sales-invoice date", () => {
    beforeEach(async () => {
      db.projects.set("p1", { salesInvoiceDate: day(15), costRecognitionStatus: "IN_PROGRESS" });
      await receive(10, 100000, 20); // purchase invoice dated AFTER the sales invoice (15 Oct), still before the issue date
    });

    it("AVERAGE: allowed with a warning and a flag on the consumption", async () => {
      const result = await issueAndConfirm("i1", 2, { projectId: "p1" });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatch(/ngày hóa đơn mua sau ngày hóa đơn bán/);
      expect(db.consumptions[0].invoiceDateWarning).toBe(true);
    });

    it("FIFO: hard block", async () => {
      db.costingConfigs.push({ method: "FIFO", effectiveFrom: new Date("2026-01-01T00:00:00.000Z") });
      db.addIssue({ id: "i1", items: [{ materialId: "m1", quantity: 2 }], date: issueDate, projectId: "p1" });
      const error = await service.confirm("i1", admin).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toMatch(/FIFO/);
    });

    it("no sales invoice date anywhere -> check skipped", async () => {
      db.projects.set("p1", { salesInvoiceDate: null, costRecognitionStatus: "IN_PROGRESS" });
      const result = await issueAndConfirm("i1", 2, { projectId: "p1" });
      expect(result.warnings).toHaveLength(0);
      expect(db.consumptions[0].invoiceDateWarning).toBe(false);
    });

    it("allocation sales date takes precedence over the project's", async () => {
      db.allocations.set("a1", { salesInvoiceDate: day(25) });
      const result = await issueAndConfirm("i1", 2, { projectId: "p1", allocationId: "a1" });
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("create / update", () => {
    const dto = (overrides: Record<string, unknown> = {}) => ({
      warehouseId: "wh", date: issueDate, items: [{ materialId: "m1", quantity: 2 }], ...overrides,
    });

    it("ignores a client unit price with a warning (IGNORE_WARN) and stores the costPrice estimate", async () => {
      await receive(10, 100000, 1);
      const result = await service.create(dto({ items: [{ materialId: "m1", quantity: 2, unitPrice: 999 }] }) as never, admin);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatch(/bỏ qua đơn giá nhập tay/);
      expect(db.items.at(-1)!.unitPrice.toNumber()).toBe(100000);
    });

    it("rejects a client unit price when manualIssuePriceMode = BLOCK", async () => {
      db.settings.set("inventory.manualIssuePriceMode", JSON.stringify("BLOCK"));
      await expect(
        service.create(dto({ items: [{ materialId: "m1", quantity: 2, unitPrice: 999 }] }) as never, admin)
      ).rejects.toThrow(/không được nhập đơn giá/i);
      // omitting the price is always fine
      await expect(service.create(dto() as never, admin)).resolves.toMatchObject({ warnings: [] });
    });

    it("derives reasonType: PROJECT with projectId, OTHER without; non-PROJECT needs no project", async () => {
      await service.create(dto({ projectId: "p1" }) as never, admin);
      await service.create(dto() as never, admin);
      await service.create(dto({ reasonType: "WARRANTY" }) as never, admin);
      expect(db.issues.map((i) => i.reasonType)).toEqual(["PROJECT", "OTHER", "WARRANTY"]);
      await expect(service.create(dto({ reasonType: "PROJECT" }) as never, admin)).rejects.toThrow(/dự án/);
    });

    it("a CONFIRMED issue cannot be edited", async () => {
      db.addIssue({ id: "i1", items: [{ materialId: "m1", quantity: 1 }], status: "CONFIRMED" });
      await expect(service.update("i1", dto() as never, admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancel", () => {
    it("DRAFT cancel works without a body or permission beyond edit (legacy behaviour)", async () => {
      db.addIssue({ id: "i1", items: [{ materialId: "m1", quantity: 1 }] });
      const result = await service.cancel("i1", {}, staff);
      expect(result.status).toBe("CANCELLED");
      expect(db.receipts).toHaveLength(0);
    });

    it("issue then cancel restores stock, every lot and costPrice; writes a RETURN_FROM_PROJECT receipt + audit", async () => {
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);
      await issueAndConfirm("i1", 12);
      expect(db.stock("m1")).toBe(8);

      const result = await service.cancel("i1", { reason: "Nhập nhầm số lượng" }, admin);

      expect(result).toMatchObject({ status: "CANCELLED", alreadyCancelled: false, cancelReason: "Nhập nhầm số lượng" });
      expect(db.stock("m1")).toBe(20);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(10);
      expect(db.lot("lot-2").remainingQuantity.toNumber()).toBe(10);
      expect(db.costPrice("m1")).toBe(120000);
      expect(db.receipts).toHaveLength(1);
      expect(db.receipts[0]).toMatchObject({
        receiptType: "RETURN_FROM_PROJECT", status: "CONFIRMED", returnedFromIssueId: "i1", warehouseId: "wh",
      });
      expect(db.receipts[0].notes).toContain("Nhập nhầm số lượng");
      expect(db.receipts[0].totalAmount.toNumber()).toBe(1440000);
      const issue = db.issues[0];
      expect(issue).toMatchObject({ status: "CANCELLED", cancelReason: "Nhập nhầm số lượng", cancelledById: "admin-1" });
      expect(issue.cancelledAt).toBeInstanceOf(Date);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "cancel", resource: "stock-issues", resourceId: "i1",
          changes: expect.objectContaining({ before: expect.objectContaining({ status: "CONFIRMED" }), after: expect.objectContaining({ status: "CANCELLED" }) }),
        })
      );
    });

    it("a receipt between issue and cancel -> costPrice recalculated with the moving-average formula", async () => {
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);
      await issueAndConfirm("i1", 5); // stock 15 @ 120k
      await receive(5, 180000, 3); // stock 20 @ 135k
      expect(db.costPrice("m1")).toBe(135000);

      await service.cancel("i1", { reason: "Hủy xuất nhầm dự án" }, admin);

      expect(db.stock("m1")).toBe(25);
      // (20 x 135,000 + 5 x 120,000) / 25 = 132,000
      expect(db.costPrice("m1")).toBe(132000);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(10);
    });

    it("FIFO issue: lots restored exactly and costPrice is unchanged by the round trip", async () => {
      db.costingConfigs.push({ method: "FIFO", effectiveFrom: new Date("2026-01-01T00:00:00.000Z") });
      await receive(10, 100000, 1);
      await receive(10, 140000, 2);
      await issueAndConfirm("i1", 12);
      await service.cancel("i1", { reason: "Hủy phiếu FIFO" }, admin);

      expect(db.stock("m1")).toBe(20);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(10);
      expect(db.lot("lot-2").remainingQuantity.toNumber()).toBe(10);
      expect(db.costPrice("m1")).toBe(120000);
    });

    it("is idempotent: the second cancel returns the existing state without returning stock again", async () => {
      await receive(10, 100000, 1);
      await issueAndConfirm("i1", 4);
      const first = await service.cancel("i1", { reason: "Hủy lần một" }, admin);
      const second = await service.cancel("i1", { reason: "Hủy lần hai" }, admin);

      expect(first.alreadyCancelled).toBe(false);
      expect(second).toMatchObject({ status: "CANCELLED", alreadyCancelled: true, returnReceiptId: first.returnReceiptId });
      expect(db.stock("m1")).toBe(10);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(10);
      expect(db.receipts).toHaveLength(1);
      expect(audit.record.mock.calls.filter(([entry]) => entry.action === "cancel")).toHaveLength(1);
      expect(db.issues[0].cancelReason).toBe("Hủy lần một");
    });

    it("concurrent double cancel returns stock only once", async () => {
      await receive(10, 100000, 1);
      await issueAndConfirm("i1", 4);

      const results = await Promise.all([
        service.cancel("i1", { reason: "Hủy song song 1" }, admin),
        service.cancel("i1", { reason: "Hủy song song 2" }, admin),
      ]);

      expect(results.filter((r) => !r.alreadyCancelled)).toHaveLength(1);
      expect(db.stock("m1")).toBe(10);
      expect(db.lot("lot-1").remainingQuantity.toNumber()).toBe(10);
      expect(db.receipts).toHaveLength(1);
    });

    it("requires a reason of at least 5 characters and inventory.approve", async () => {
      await receive(10, 100000, 1);
      await issueAndConfirm("i1", 4);
      await expect(service.cancel("i1", {}, admin)).rejects.toThrow(/lý do/i);
      await expect(service.cancel("i1", { reason: "abc" }, admin)).rejects.toThrow(/lý do/i);
      await expect(service.cancel("i1", { reason: "Lý do hợp lệ" }, staff)).rejects.toThrow(ForbiddenException);
      expect(db.issues[0].status).toBe("CONFIRMED");
      expect(db.stock("m1")).toBe(6);
    });

    it("is blocked when the period is locked", async () => {
      await receive(10, 100000, 1);
      await issueAndConfirm("i1", 4);
      db.settings.set("inventory.periodLockedUntil", JSON.stringify("2026-11-30"));
      await expect(service.cancel("i1", { reason: "Hủy trong kỳ khóa" }, admin)).rejects.toThrow(/khóa.*phiếu hoàn kho/s);
      expect(db.issues[0].status).toBe("CONFIRMED");
      expect(db.stock("m1")).toBe(6);
      expect(db.receipts).toHaveLength(0);
    });

    it("is blocked when the project is DELIVERED", async () => {
      await receive(10, 100000, 1);
      db.projects.set("p1", { salesInvoiceDate: null, costRecognitionStatus: "DELIVERED" });
      await issueAndConfirm("i1", 4, { projectId: "p1" });
      await expect(service.cancel("i1", { reason: "Hủy dự án đã bàn giao" }, admin)).rejects.toThrow(/đã bàn giao.*phiếu hoàn kho/s);
      expect(db.issues[0].status).toBe("CONFIRMED");
      expect(db.stock("m1")).toBe(6);
    });

    it("is blocked when lot-consumption data is missing (legacy issue)", async () => {
      await receive(10, 100000, 1);
      db.addIssue({ id: "old", items: [{ materialId: "m1", quantity: 4 }], status: "CONFIRMED" });
      await expect(service.cancel("old", { reason: "Hủy phiếu cũ" }, admin)).rejects.toThrow(/thiếu dữ liệu lô.*phiếu hoàn kho/s);
      expect(db.issues[0].status).toBe("CONFIRMED");
      expect(db.receipts).toHaveLength(0);
    });

    it("throws NotFound for an unknown issue", async () => {
      await expect(service.cancel("nope", { reason: "Không tồn tại" }, admin)).rejects.toThrow(NotFoundException);
    });
  });
});
