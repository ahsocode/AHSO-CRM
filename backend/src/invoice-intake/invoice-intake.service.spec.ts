import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { createReceiptFromInvoiceSchema, type CreateReceiptFromInvoiceDto } from "./dto/invoice-intake.dto";
import { InvoiceIntakeService } from "./invoice-intake.service";
import { MaterialMatchingService } from "./material-matching.service";
import { FakeIntakeDb, type Row } from "./testing/fake-intake-db";

type Raw = Record<string, unknown>;

describe("InvoiceIntakeService (spec §10 acceptance fixtures, synthetic data)", () => {
  const user = { sub: "svc-user", email: "s@ahso.vn", name: "Intake", role: "STAFF" as const, permissions: [] };
  const AHSO_TAX = "0316896939";

  let db: FakeIntakeDb;
  let audit: { record: jest.Mock };
  let service: InvoiceIntakeService;
  let misumi: Row;
  let hanna: Row;
  let xanhSm: Row;
  let bolt: Row;
  let sensor: Row;
  let cable: Row;

  const parse = (raw: Raw): CreateReceiptFromInvoiceDto => createReceiptFromInvoiceSchema.parse(raw);

  beforeEach(() => {
    db = new FakeIntakeDb();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma = db.client as unknown as PrismaService;
    const matching = new MaterialMatchingService(prisma, audit as unknown as AuditService);
    service = new InvoiceIntakeService(prisma, matching, audit as unknown as AuditService);

    db.seed("warehouse", { name: "Kho chính", isActive: true });
    misumi = db.seed("supplier", { name: "Misumi (giả lập)", taxCode: "0101000001", supplierType: "GOODS" });
    hanna = db.seed("supplier", { name: "Hanna (giả lập)", taxCode: "0101000002", supplierType: "GOODS" });
    xanhSm = db.seed("supplier", { name: "Xanh SM (giả lập)", taxCode: "0101000003", supplierType: "EXPENSE" });
    bolt = db.seed("material", { code: "VT-BOLT", name: "Bu lông M8", unit: "cái", kind: "STOCK", isActive: true });
    sensor = db.seed("material", { code: "VT-SENSOR", name: "Cảm biến pH", unit: "cái", kind: "STOCK", isActive: true });
    cable = db.seed("material", { code: "VT-CABLE", name: "Cáp tín hiệu", unit: "m", kind: "STOCK", isActive: true });
  });

  const alias = (supplier: Row, material: Row, extra: Raw = {}) =>
    db.seed("materialAlias", { supplierId: supplier.id, supplierItemCode: null, supplierItemName: "x", normalizedName: "x", unitConversion: null, supplierUnit: null, createdAt: new Date(), materialId: material.id, ...extra });

  const baseHeader = (over: Raw = {}): Raw => ({
    sellerTaxCode: "0101000001",
    series: "C26TAA",
    number: "0000100",
    date: "2026-11-05",
    source: "EMAIL_AUTO",
    ...over
  });

  describe("Misumi: matched + unmatched goods lines", () => {
    it("creates a DRAFT PENDING_REVIEW receipt, items for alias matches, pending lines for the rest, prices ex-VAT", async () => {
      alias(misumi, bolt, { supplierItemCode: "MS-BOLT-8", supplierItemName: "Bolt M8", normalizedName: "bolt m8" });
      const result = await service.createFromInvoice(
        parse({
          ...baseHeader(),
          vatTotal: 160000,
          totalDeclared: 1760000,
          lines: [
            { lineNo: 1, code: "MS-BOLT-8", name: "Bolt M8", unit: "pcs", qty: 100, unitPrice: 5000, vatRate: 10, vatAmount: 50000, lineKind: "GOODS" },
            { lineNo: 2, code: "MS-UNKNOWN", name: "Linear shaft 12mm", unit: "pcs", qty: 2, unitPrice: 550000, vatRate: 10, vatAmount: 110000, lineKind: "GOODS" }
          ]
        }),
        user
      );

      expect(result).toMatchObject({ created: true, alreadyExists: false, status: "DRAFT", reviewStatus: "PENDING_REVIEW", matchedLines: 1, pendingLines: 1, expenseLines: 0 });
      expect(result.roundingDiff).toBe(0);
      const receipt = db.tables.stockReceipt[0];
      expect(receipt).toMatchObject({ status: "DRAFT", reviewStatus: "PENDING_REVIEW", source: "EMAIL_AUTO", receiptType: "PURCHASE", supplierId: misumi.id, purchaseInvoiceNo: "C26TAA-0000100" });
      const items = db.tables.stockReceiptItem;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ materialId: bolt.id, sourceLineNo: 1 });
      expect(String(items[0].unitPrice)).toBe("5000");
      expect(String(items[0].total)).toBe("500000");
      expect(String(items[0].vatAmount)).toBe("50000");
      expect(String(receipt.totalAmount)).toBe("500000"); // pending line adds nothing until resolved
      expect(db.tables.receiptPendingLine).toHaveLength(1);
      expect(db.tables.receiptPendingLine[0]).toMatchObject({ status: "PENDING", lineNo: 2, supplierItemName: "Linear shaft 12mm" });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "invoice_intake.create" }));
    });

    it("never auto-accepts a fuzzy name candidate (no alias => pending line)", async () => {
      const result = await service.createFromInvoice(
        parse({ ...baseHeader({ number: "0000101" }), lines: [{ lineNo: 1, name: "Bu long M8", unit: "cai", qty: 1, unitPrice: 1000 }] }),
        user
      );
      expect(result.matchedLines).toBe(0);
      expect(result.pendingLines).toBe(1);
      expect(db.tables.stockReceiptItem).toHaveLength(0);
    });

    it("MANUAL source creates a DRAFT without a review gate", async () => {
      alias(misumi, bolt, { supplierItemName: "Bolt", normalizedName: "bolt" });
      const result = await service.createFromInvoice(
        parse({ ...baseHeader({ source: "MANUAL", number: "0000102" }), lines: [{ lineNo: 1, name: "Bolt", qty: 1, unitPrice: 1000 }] }),
        user
      );
      expect(result.status).toBe("DRAFT");
      expect(result.reviewStatus).toBeNull();
    });
  });

  describe("Hanna: unit conversion and rounding", () => {
    it("converts supplier units, keeps conversion rounding in roundingDiff, never touches costPrice", async () => {
      alias(hanna, sensor, { supplierItemCode: "HI-PH", supplierItemName: "pH probe", normalizedName: "ph probe", unitConversion: new Decimal(3), supplierUnit: "bộ" });
      const result = await service.createFromInvoice(
        parse({
          ...baseHeader({ sellerTaxCode: "0101000002", number: "0000200" }),
          vatTotal: 10000,
          totalDeclared: 110000,
          lines: [{ lineNo: 1, code: "HI-PH", name: "pH probe", unit: "bộ", qty: 1, unitPrice: 100000, vatRate: 10, vatAmount: 10000 }]
        }),
        user
      );
      const item = db.tables.stockReceiptItem[0];
      expect(String(item.quantity)).toBe("3");
      expect(String(item.unitPrice)).toBe("33333"); // 100000 / 3 rounded
      expect(String(item.total)).toBe("99999");
      // declared 110000 - (99999 + 10000) = 1
      expect(result.roundingDiff).toBe(1);
      expect(Number(db.tables.stockReceipt[0].roundingDiff)).toBe(1);
      expect(result.warnings.join(" ")).not.toMatch(/lệch/);
      expect(Number(sensor.costPrice ?? 0)).toBe(0);
    });
  });

  describe("rounding difference", () => {
    const lines = [{ lineNo: 1, name: "Cap", qty: 10, unitPrice: 100000, vatRate: 10, vatAmount: 100000 }];

    it("stores declared - (lines + VAT) without altering line prices", async () => {
      alias(misumi, cable, { supplierItemName: "Cap", normalizedName: "cap" });
      const result = await service.createFromInvoice(parse({ ...baseHeader({ number: "0000300" }), vatTotal: 100000, totalDeclared: 1100300, lines }), user);
      expect(result.roundingDiff).toBe(300);
      expect(String(db.tables.stockReceiptItem[0].unitPrice)).toBe("100000");
      expect(result.warnings.join(" ")).not.toMatch(/vượt ngưỡng/);
    });

    it("warns (does not block) above 1.000 đ", async () => {
      alias(misumi, cable, { supplierItemName: "Cap", normalizedName: "cap" });
      const result = await service.createFromInvoice(parse({ ...baseHeader({ number: "0000301" }), vatTotal: 100000, totalDeclared: 1105000, lines }), user);
      expect(result.created).toBe(true);
      expect(result.roundingDiff).toBe(5000);
      expect(result.warnings.join(" ")).toMatch(/vượt ngưỡng/);
    });

    it("handles negative differences", async () => {
      alias(misumi, cable, { supplierItemName: "Cap", normalizedName: "cap" });
      const result = await service.createFromInvoice(parse({ ...baseHeader({ number: "0000302" }), vatTotal: 100000, totalDeclared: 1099500, lines }), user);
      expect(result.roundingDiff).toBe(-500);
    });
  });

  describe("Xanh SM: service/expense invoice", () => {
    const xanhInvoice = (over: Raw = {}) =>
      parse({
        ...baseHeader({ sellerTaxCode: "0101000003", series: "C26TXS", number: "0009001" }),
        vatTotal: 8000,
        totalDeclared: 88000,
        lines: [{ lineNo: 1, name: "Cước vận chuyển taxi", unit: "chuyến", qty: 1, unitPrice: 80000, vatRate: 10, vatAmount: 8000, lineKind: "EXPENSE", costGroup: "TRAVEL" }],
        ...over
      });

    it("creates no receipt/stock; creates a TRAVEL ProjectCost row (unassigned, pending review)", async () => {
      const result = await service.createFromInvoice(xanhInvoice(), user);
      expect(result).toMatchObject({ created: true, receiptId: null, expenseLines: 1, matchedLines: 0, pendingLines: 0 });
      expect(db.calls.receiptCreate).toBe(0);
      expect(db.tables.stockReceipt).toHaveLength(0);
      expect(db.tables.stockReceiptItem).toHaveLength(0);
      const cost = db.tables.projectCost[0];
      expect(cost).toMatchObject({
        group: "TRAVEL", projectId: null, supplierId: xanhSm.id, sellerTaxCode: "0101000003", invoiceSeries: "C26TXS",
        invoiceNumber: "0009001", lineNo: 1, source: "EMAIL_AUTO", reviewStatus: "PENDING_REVIEW", receiptId: null
      });
      expect(String(cost.amount)).toBe("80000");
      expect(String(cost.vatAmount)).toBe("8000");
      expect(result.expenseLineIds).toEqual([cost.id]);
    });

    it("treats GOODS lines of an EXPENSE supplier as costs, not stock", async () => {
      const result = await service.createFromInvoice(
        xanhInvoice({ lines: [{ lineNo: 1, name: "Chạy xe", qty: 1, unitPrice: 50000 }] }) as CreateReceiptFromInvoiceDto,
        user
      );
      expect(result.expenseLines).toBe(1);
      expect(db.tables.stockReceipt).toHaveLength(0);
      expect(db.tables.projectCost[0].group).toBe("OTHER");
    });

    it("is idempotent for expense-only invoices", async () => {
      await service.createFromInvoice(xanhInvoice(), user);
      const second = await service.createFromInvoice(xanhInvoice(), user);
      expect(second).toMatchObject({ alreadyExists: true, created: false });
      expect(db.tables.projectCost).toHaveLength(1);
    });

    it("mixed invoice: goods become a receipt, service lines become costs linked to it", async () => {
      alias(misumi, bolt, { supplierItemName: "Bolt", normalizedName: "bolt" });
      const result = await service.createFromInvoice(
        parse({
          ...baseHeader({ number: "0000400" }),
          lines: [
            { lineNo: 1, name: "Bolt", qty: 10, unitPrice: 1000 },
            { lineNo: 2, name: "Phí vận chuyển", qty: 1, unitPrice: 30000, lineKind: "SERVICE", costGroup: "SHIPPING" }
          ]
        }),
        user
      );
      expect(result.matchedLines).toBe(1);
      expect(result.expenseLines).toBe(1);
      expect(db.tables.projectCost[0]).toMatchObject({ group: "SHIPPING", receiptId: result.receiptId });
      expect(db.tables.stockReceiptItem).toHaveLength(1);
    });
  });

  describe("AHSO sales invoices are skipped", () => {
    it.each(["0316896939", "0316 896 939", "0316896939-001"])("skips seller %s and writes nothing", async (seller) => {
      const result = await service.createFromInvoice(
        parse({ ...baseHeader({ sellerTaxCode: seller, series: "C26AHS", number: "0000010" }), lines: [{ lineNo: 1, name: "Máy lọc", qty: 1, unitPrice: 9000000 }] }),
        user
      );
      expect(result).toMatchObject({ skipped: "SALES_INVOICE" });
      expect(db.calls.transaction).toBe(0);
      expect(db.tables.stockReceipt).toHaveLength(0);
      expect(db.tables.projectCost).toHaveLength(0);
      expect(db.tables.receiptPendingLine).toHaveLength(0);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it("uses the company tax code from settings when configured", async () => {
      db.settings.set("company.taxCode", JSON.stringify("0999999999"));
      const result = await service.createFromInvoice(
        parse({ ...baseHeader({ sellerTaxCode: "0999999999" }), lines: [{ lineNo: 1, name: "X", qty: 1, unitPrice: 1 }] }),
        user
      );
      expect(result.skipped).toBe("SALES_INVOICE");
      expect(AHSO_TAX).toBe("0316896939");
    });
  });

  describe("idempotency", () => {
    const dup = () =>
      parse({ ...baseHeader({ number: "0000500" }), lines: [{ lineNo: 1, name: "Unknown part", qty: 1, unitPrice: 1000 }] });

    it("second submission returns the existing receipt with alreadyExists:true and creates nothing", async () => {
      const first = await service.createFromInvoice(dup(), user);
      const second = await service.createFromInvoice(dup(), user);
      expect(first.created).toBe(true);
      expect(second).toMatchObject({ alreadyExists: true, created: false, receiptId: first.receiptId, receiptNo: first.receiptNo });
      expect(db.tables.stockReceipt).toHaveLength(1);
      expect(db.tables.receiptPendingLine).toHaveLength(1);
    });

    it("concurrent submissions: the loser hits the unique index (P2002) and gets the winner's receipt", async () => {
      db.blindLookups = 0;
      const results = await Promise.all([service.createFromInvoice(dup(), user), service.createFromInvoice(dup(), user)]);
      expect(db.tables.stockReceipt).toHaveLength(1);
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(results.filter((r) => r.alreadyExists)).toHaveLength(1);
      expect(results[0].receiptId).toBe(results[1].receiptId);
    });

    it("lost race through the pre-check: P2002 is translated, not thrown", async () => {
      await service.createFromInvoice(dup(), user);
      db.blindLookups = 1; // the pre-check inside the tx sees nothing
      const second = await service.createFromInvoice(dup(), user);
      expect(second).toMatchObject({ alreadyExists: true, created: false });
      expect(db.tables.stockReceipt).toHaveLength(1);
    });

    it("a CANCELLED receipt does not block re-submission", async () => {
      const first = await service.createFromInvoice(dup(), user);
      (db.tables.stockReceipt[0] as Raw).status = "CANCELLED";
      const again = await service.createFromInvoice(dup(), user);
      expect(again.created).toBe(true);
      expect(again.receiptId).not.toBe(first.receiptId);
    });

    it("rejects an unknown seller instead of creating a supplier", async () => {
      await expect(
        service.createFromInvoice(parse({ ...baseHeader({ sellerTaxCode: "0777777777" }), lines: [{ lineNo: 1, name: "x", qty: 1, unitPrice: 1 }] }), user)
      ).rejects.toThrow(UnprocessableEntityException);
      expect(db.tables.supplier).toHaveLength(3);
    });
  });

  describe("replacement / adjustment invoices", () => {
    let original: Row;

    beforeEach(() => {
      original = db.seed("stockReceipt", {
        receiptNo: "PN-2026-001", warehouseId: db.tables.warehouse[0].id, supplierId: misumi.id, status: "CONFIRMED", receiptType: "PURCHASE",
        sellerTaxCode: "0101000001", invoiceSeries: "C26TAA", invoiceNumber: "0000001", purchaseInvoiceNo: "C26TAA-0000001"
      });
      db.seed("stockReceiptItem", { receiptId: original.id, materialId: bolt.id, quantity: new Decimal(10), unitPrice: new Decimal(100000), total: new Decimal(1000000) });
      db.seed("stockReceiptItem", { receiptId: original.id, materialId: sensor.id, quantity: new Decimal(5), unitPrice: new Decimal(100000), total: new Decimal(500000) });
    });

    const replacement = (over: Raw = {}) =>
      parse({
        ...baseHeader({ number: "0000002", invoiceType: "REPLACEMENT", relatedInvoiceRef: "C26TAA-0000001" }),
        lines: [
          { lineNo: 1, name: "Bolt", qty: 8, unitPrice: 100000, materialId: bolt.id },
          { lineNo: 2, name: "Sensor", qty: 5, unitPrice: 110000, materialId: sensor.id }
        ],
        ...over
      });

    it("creates an ADJUSTMENT receipt with deltas against the original, not a second purchase", async () => {
      const result = await service.createFromInvoice(replacement(), user);
      expect(result).toMatchObject({ created: true, receiptType: "ADJUSTMENT", status: "DRAFT", reviewStatus: "PENDING_REVIEW" });
      const receipt = db.tables.stockReceipt.find((r) => r.id === result.receiptId) as Row;
      expect(receipt).toMatchObject({ receiptType: "ADJUSTMENT", adjustsReceiptId: original.id, invoiceType: "REPLACEMENT", relatedInvoiceRef: "C26TAA-0000001", invoiceNumber: "0000002" });

      const items = db.tables.stockReceiptItem.filter((i) => i.receiptId === receipt.id);
      const boltLine = items.find((i) => i.materialId === bolt.id) as Row;
      const sensorLine = items.find((i) => i.materialId === sensor.id) as Row;
      expect(String(boltLine.quantity)).toBe("-2");
      expect(String(boltLine.total)).toBe("-200000");
      expect(String(sensorLine.quantity)).toBe("0");
      expect(String(sensorLine.valueAdjustment)).toBe("50000"); // 5 * (110000 - 100000)
      expect(String(receipt.totalAmount)).toBe("-150000");
      // no duplicate purchase receipt
      expect(db.tables.stockReceipt.filter((r) => r.receiptType === "PURCHASE")).toHaveLength(1);
    });

    it("a second replacement diffs against original + previous adjustments", async () => {
      await service.createFromInvoice(replacement(), user);
      const result = await service.createFromInvoice(
        replacement({
          number: "0000003",
          lines: [
            { lineNo: 1, name: "Bolt", qty: 8, unitPrice: 100000, materialId: bolt.id },
            { lineNo: 2, name: "Sensor", qty: 5, unitPrice: 110000, materialId: sensor.id }
          ]
        } as Raw),
        user
      );
      // identical effective state => nothing to adjust
      expect(result).toMatchObject({ created: false, noDifference: true });
      expect(db.tables.stockReceipt.filter((r) => r.receiptType === "ADJUSTMENT")).toHaveLength(1);
    });

    it("is idempotent on the replacement invoice number", async () => {
      await service.createFromInvoice(replacement(), user);
      const again = await service.createFromInvoice(replacement(), user);
      expect(again.alreadyExists).toBe(true);
      expect(db.tables.stockReceipt.filter((r) => r.receiptType === "ADJUSTMENT")).toHaveLength(1);
    });

    it("rejects when the original is still a DRAFT", async () => {
      original.status = "DRAFT";
      await expect(service.createFromInvoice(replacement(), user)).rejects.toThrow(/chưa được xác nhận/);
    });

    it("rejects when the original cannot be found or no reference is given", async () => {
      await expect(service.createFromInvoice(replacement({ relatedInvoiceRef: "C26TAA-9999999" }), user)).rejects.toThrow(UnprocessableEntityException);
      await expect(service.createFromInvoice(replacement({ relatedInvoiceRef: undefined }), user)).rejects.toThrow(BadRequestException);
    });

    it("rejects unmatched goods lines (must save an alias first)", async () => {
      await expect(
        service.createFromInvoice(replacement({ lines: [{ lineNo: 1, name: "Mystery", qty: 1, unitPrice: 1 }] }), user)
      ).rejects.toThrow(/save_material_alias/);
      expect(db.tables.stockReceipt.filter((r) => r.receiptType === "ADJUSTMENT")).toHaveLength(0);
    });

    it("ADJUSTMENT invoices leave materials they do not mention untouched", async () => {
      const result = await service.createFromInvoice(
        replacement({ invoiceType: "ADJUSTMENT", lines: [{ lineNo: 1, name: "Bolt", qty: 10, unitPrice: 90000, materialId: bolt.id }] }),
        user
      );
      const items = db.tables.stockReceiptItem.filter((i) => i.receiptId === result.receiptId);
      expect(items).toHaveLength(1);
      expect(String(items[0].valueAdjustment)).toBe("-100000");
      expect(result.warnings.join(" ")).toMatch(/không bị thay đổi/);
    });
  });

  describe("period lock", () => {
    it("refuses to create a draft dated inside a locked period", async () => {
      db.settings.set("inventory.periodLockedUntil", JSON.stringify("2026-11-30"));
      alias(misumi, bolt, { supplierItemName: "Bolt", normalizedName: "bolt" });
      await expect(
        service.createFromInvoice(parse({ ...baseHeader({ number: "0000600" }), lines: [{ lineNo: 1, name: "Bolt", qty: 1, unitPrice: 1 }] }), user)
      ).rejects.toThrow(/khóa/);
      expect(db.tables.stockReceipt).toHaveLength(0);
    });
  });

  it("uses the token owner for FK created-by columns when called by a machine principal", async () => {
    const machine = { ...user, sub: "service:tok1", ownerUserId: "owner-1" };
    await service.createFromInvoice(parse({ ...baseHeader({ number: "0000700" }), lines: [{ lineNo: 1, name: "Z", qty: 1, unitPrice: 1 }] }), machine);
    expect(db.tables.stockReceipt[0].createdById).toBe("owner-1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: "service:tok1", changes: expect.objectContaining({ meta: { actorType: "SERVICE" } }) }));
  });
});
