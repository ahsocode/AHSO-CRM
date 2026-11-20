import { ConflictException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { addToAggregate, computeAdjustmentLines, type MaterialAggregate } from "./adjustment.util";
import { saveAliasSchema, matchLineSchema } from "./dto/invoice-intake.dto";
import { isSameTaxCode, nameSimilarity, normalizeItemName, parseInvoiceRef } from "./invoice-intake.utils";
import { MaterialMatchingService } from "./material-matching.service";
import { PendingLinesService } from "./pending-lines.service";
import { FakeIntakeDb, type Row } from "./testing/fake-intake-db";

const user = { sub: "u1", email: "u@ahso.vn", name: "U", role: "STAFF" as const, permissions: [] };

describe("invoice-intake utils", () => {
  it("normalises names: lowercase, no diacritics, punctuation and spaces collapsed", () => {
    expect(normalizeItemName("  Bu-lông   Inox  M8x20 (A2) ")).toBe("bu long inox m8x20 a2");
    expect(normalizeItemName("ĐẦU NỐI / Ống")).toBe("dau noi ong");
    expect(normalizeItemName(null)).toBe("");
  });

  it("parses invoice references and tax codes", () => {
    expect(parseInvoiceRef("C26TAA-0000123")).toEqual({ series: "C26TAA", number: "0000123" });
    expect(parseInvoiceRef("0000123")).toBeNull();
    expect(isSameTaxCode("0316 896 939", "0316896939-001")).toBe(true);
    expect(isSameTaxCode("0101000001", "0316896939")).toBe(false);
    expect(isSameTaxCode("", "")).toBe(false);
  });

  it("scores similar names higher than unrelated ones and never reaches 1", () => {
    expect(nameSimilarity("Bu lông M8", "bu-long m8 inox")).toBeGreaterThan(0.6);
    expect(nameSimilarity("Bu lông M8", "Cảm biến pH")).toBe(0);
    expect(nameSimilarity("abc", "ABC")).toBeLessThan(1);
  });
});

describe("computeAdjustmentLines", () => {
  const agg = (qty: number, total: number): MaterialAggregate => ({ quantity: new Decimal(qty), total: new Decimal(total) });

  it("emits quantity and price lines, exact with Decimal", () => {
    const original = new Map([["a", agg(3, 100)]]);
    const next = new Map([["a", agg(3, 100.5)]]);
    addToAggregate(next, "b", 2, 10);
    const { lines } = computeAdjustmentLines(original, next, true);
    const a = lines.find((l) => l.materialId === "a");
    const b = lines.find((l) => l.materialId === "b");
    expect(a?.valueAdjustment?.toString()).toBe("1"); // 0.5 rounds to 1 (VND)
    expect(b?.quantity.toString()).toBe("2");
  });

  it("replacement removes missing materials, adjustment leaves them", () => {
    const original = new Map([["a", agg(2, 200)]]);
    const next = new Map<string, MaterialAggregate>();
    expect(computeAdjustmentLines(original, next, true).lines[0].quantity.toString()).toBe("-2");
    const res = computeAdjustmentLines(original, next, false);
    expect(res.lines).toHaveLength(0);
    expect(res.untouchedMaterialIds).toEqual(["a"]);
  });
});

describe("DTO validation", () => {
  it("requires supplierId or supplierTaxCode", () => {
    expect(matchLineSchema.safeParse({ itemName: "x" }).success).toBe(false);
    expect(matchLineSchema.safeParse({ itemName: "x", supplierTaxCode: "0101" }).success).toBe(true);
    expect(saveAliasSchema.safeParse({ supplierItemName: "x", materialId: "m" }).success).toBe(false);
  });
});

describe("MaterialMatchingService + PendingLinesService", () => {
  let db: FakeIntakeDb;
  let matching: MaterialMatchingService;
  let pending: PendingLinesService;
  let supplier: Row;
  let bolt: Row;
  let nut: Row;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    db = new FakeIntakeDb();
    const prisma = db.client as unknown as PrismaService;
    matching = new MaterialMatchingService(prisma, audit as unknown as AuditService);
    pending = new PendingLinesService(prisma, matching, audit as unknown as AuditService);
    supplier = db.seed("supplier", { name: "NCC A", taxCode: "0101000001", supplierType: "GOODS" });
    bolt = db.seed("material", { code: "VT-BOLT", name: "Bu lông M8 inox", unit: "cái", kind: "STOCK" });
    nut = db.seed("material", { code: "VT-NUT", name: "Đai ốc M8", unit: "cái", kind: "STOCK" });
    db.seed("material", { code: "VT-SVC", name: "Bu lông dịch vụ", unit: "lần", kind: "SERVICE" });
  });

  it("matches by supplier item code first, then by normalised name", async () => {
    await matching.saveAlias({ supplierId: supplier.id, supplierItemCode: "A-1", supplierItemName: "Bolt M8", materialId: bolt.id }, user);
    await matching.saveAlias({ supplierId: supplier.id, supplierItemName: "Đai ốc M8!", materialId: nut.id }, user);

    const byCode = await matching.matchLine({ supplierTaxCode: "0101000001", itemCode: "A-1", itemName: "whatever" });
    expect(byCode.matched).toMatchObject({ id: bolt.id });
    expect(byCode.confidence).toBe(1);

    const byName = await matching.matchLine({ supplierId: supplier.id as string, itemName: "dai-oc  m8" });
    expect(byName.matched).toMatchObject({ id: nut.id });
    expect(byName.confidence).toBe(0.95);
  });

  it("returns fuzzy candidates only as suggestions (matched stays null), excluding SERVICE materials", async () => {
    const result = await matching.matchLine({ supplierId: supplier.id as string, itemName: "Bu long M8" });
    expect(result.matched).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].materialId).toBe(bolt.id);
    expect(result.candidates.map((c) => c.code)).not.toContain("VT-SVC");
  });

  it("a code equal to Material.code scores 1.0 as a suggestion", async () => {
    const result = await matching.matchLine({ supplierId: supplier.id as string, itemCode: "vt-nut", itemName: "unrelated" });
    expect(result.matched).toBeNull();
    expect(result.candidates[0]).toMatchObject({ materialId: nut.id, score: 1 });
  });

  it("the same name mapped to two materials is ambiguous: no auto match", async () => {
    db.seed("materialAlias", { supplierId: supplier.id, supplierItemCode: "X1", supplierItemName: "Ốc", normalizedName: "oc", materialId: bolt.id, createdAt: new Date() });
    db.seed("materialAlias", { supplierId: supplier.id, supplierItemCode: "X2", supplierItemName: "Ốc", normalizedName: "oc", materialId: nut.id, createdAt: new Date() });
    const result = await matching.matchLine({ supplierId: supplier.id as string, itemName: "Ốc" });
    expect(result.matched).toBeNull();
  });

  it("saveAlias upserts instead of duplicating (code key and name key)", async () => {
    const first = await matching.saveAlias({ supplierId: supplier.id, supplierItemCode: "A-1", supplierItemName: "Bolt", materialId: bolt.id }, user);
    const again = await matching.saveAlias({ supplierId: supplier.id, supplierItemCode: "A-1", supplierItemName: "Bolt v2", materialId: nut.id, unitConversion: 2 }, user);
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(db.tables.materialAlias).toHaveLength(1);
    expect(db.tables.materialAlias[0]).toMatchObject({ materialId: nut.id });
    await matching.saveAlias({ supplierId: supplier.id, supplierItemName: "Plain name", materialId: bolt.id }, user);
    await matching.saveAlias({ supplierId: supplier.id, supplierItemName: "PLAIN  name", materialId: nut.id }, user);
    expect(db.tables.materialAlias).toHaveLength(2);
    expect(audit.record).toHaveBeenCalled();
  });

  describe("pending lines", () => {
    let receipt: Row;
    let line: Row;
    beforeEach(() => {
      receipt = db.seed("stockReceipt", { receiptNo: "PN-1", status: "DRAFT", receiptType: "PURCHASE", supplierId: supplier.id, totalAmount: new Decimal(0), roundingDiff: new Decimal(0) });
      line = db.seed("receiptPendingLine", {
        receiptId: receipt.id, lineNo: 1, supplierItemCode: "Z9", supplierItemName: "Thanh ray", supplierUnit: "bộ",
        quantity: new Decimal(1), unitPrice: new Decimal(100000), vatRate: null, vatAmount: null, projectId: null, status: "PENDING"
      });
    });

    it("resolve creates the real item, applies conversion, marks RESOLVED, saves alias, adjusts rounding", async () => {
      const result = await pending.resolve(line.id, { materialId: bolt.id, saveAlias: true, unitConversion: 3 }, user);
      expect(result).toMatchObject({ quantity: 3, unitPrice: 33333, total: 99999, remainingPendingLines: 0, aliasSaved: true });
      expect(db.tables.stockReceiptItem[0]).toMatchObject({ receiptId: receipt.id, materialId: bolt.id, sourceLineNo: 1 });
      expect(line.status).toBe("RESOLVED");
      expect(String(receipt.totalAmount)).toBe("99999");
      expect(String(receipt.roundingDiff)).toBe("1"); // 100000 - 99999
      expect(db.tables.materialAlias[0]).toMatchObject({ supplierItemCode: "Z9", materialId: bolt.id });
    });

    it("cannot resolve twice, nor onto a SERVICE material, nor on a confirmed receipt", async () => {
      await pending.resolve(line.id, { materialId: bolt.id, saveAlias: false }, user);
      await expect(pending.resolve(line.id, { materialId: bolt.id, saveAlias: false }, user)).rejects.toThrow(ConflictException);

      const line2 = db.seed("receiptPendingLine", { receiptId: receipt.id, lineNo: 2, supplierItemName: "Dv", quantity: new Decimal(1), unitPrice: new Decimal(1), status: "PENDING" });
      const service = db.tables.material.find((m) => m.kind === "SERVICE") as Row;
      await expect(pending.resolve(line2.id, { materialId: service.id, saveAlias: false }, user)).rejects.toThrow(/dịch vụ/);
      receipt.status = "CONFIRMED";
      await expect(pending.resolve(line2.id, { materialId: bolt.id, saveAlias: false }, user)).rejects.toThrow(/nháp/);
    });

    it("discard records the reason and blocks later resolution", async () => {
      const result = await pending.discard(line.id, { reason: "Dòng ghi chú, không phải hàng" }, user);
      expect(result.status).toBe("DISCARDED");
      expect(line.discardReason).toBe("Dòng ghi chú, không phải hàng");
      await expect(pending.resolve(line.id, { materialId: bolt.id, saveAlias: false }, user)).rejects.toThrow(ConflictException);
      expect(db.tables.stockReceiptItem).toHaveLength(0);
    });
  });
});
