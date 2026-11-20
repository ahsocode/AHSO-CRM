import { Decimal } from "@prisma/client/runtime/library";
import type { JwtUser } from "../auth/auth.types";
import type { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { inventoryValuationQuerySchema, projectCostQuerySchema, stockLedgerQuerySchema } from "./inventory-reports.dto";
import { InventoryReportsService } from "./inventory-reports.service";
import { ReceiptReportsService } from "./receipt-reports.service";

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
const admin = { sub: "u1", email: "a@x.vn", name: "Admin", role: "ADMIN", permissions: [] } as JwtUser;
const noCost = { sub: "u2", email: "s@x.vn", name: "Staff", role: "STAFF", permissions: ["inventory.view"] } as JwtUser;

const receiptRef = {
  id: "R1", receiptNo: "PN-1", invoiceSeries: "C26TAA", invoiceNumber: "0000123", invoiceDate: day("2026-01-09"),
  sellerTaxCode: "0312345678", supplier: { id: "S1", name: "NCC A", taxCode: "0312345678" }
};

function receiptItem(id: string, date: string, quantity: number, unitPrice: number, no: string) {
  return {
    id,
    materialId: "M1",
    quantity: new Decimal(quantity),
    unitPrice: new Decimal(unitPrice),
    total: new Decimal(quantity * unitPrice),
    projectId: null,
    valueAdjustment: null,
    receipt: { ...receiptRef, id: `R-${id}`, receiptNo: no, warehouseId: "W1", date: day(date), confirmedAt: day(date), receiptType: "PURCHASE" }
  };
}

// 10 x 100k (Jan), 10 x 140k (Feb), issue 5 @120k (Mar), 5 x 180k (Apr) => 20 on hand, avg 135k
const RECEIPTS = [
  receiptItem("ri1", "2026-01-10", 10, 100_000, "PN-1"),
  receiptItem("ri2", "2026-02-10", 10, 140_000, "PN-2"),
  receiptItem("ri3", "2026-04-01", 5, 180_000, "PN-3")
];
const ISSUES = [
  {
    id: "ii1",
    materialId: "M1",
    quantity: new Decimal(5),
    unitPrice: new Decimal(120_000),
    total: new Decimal(600_000),
    issue: { id: "I1", issueNo: "PX-1", warehouseId: "W1", date: day("2026-03-01"), confirmedAt: day("2026-03-01"), cancelledAt: null, status: "CONFIRMED", projectId: "P1", reasonType: "PROJECT" },
    lotConsumptions: [
      {
        stockLotId: "LOT1", quantity: new Decimal(5), lotUnitPrice: new Decimal(100_000), invoiceDateWarning: false,
        stockLot: { purchaseInvoiceDate: day("2026-01-09"), stockReceiptItem: { receipt: receiptRef } }
      }
    ]
  }
];

function balancesRow(materialId: string, quantity: number, costPrice: number, accountingClass: string | null) {
  return {
    id: `b-${materialId}`,
    warehouseId: "W1",
    materialId,
    quantity: new Decimal(quantity),
    warehouse: { code: "KHO1", name: "Kho chính" },
    material: { code: `VT-${materialId}`, name: `Vật tư ${materialId}`, unit: "cái", costPrice: new Decimal(costPrice), accountingClass }
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  const prisma = {
    $transaction: jest.fn().mockImplementation((arr: Promise<unknown>[]) => Promise.all(arr)),
    setting: { findUnique: jest.fn().mockResolvedValue(null) },
    inventoryCostingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    stockBalance: { findMany: jest.fn().mockResolvedValue([]) },
    stockReceiptItem: { findMany: jest.fn().mockResolvedValue(RECEIPTS), count: jest.fn().mockResolvedValue(0) },
    stockIssueItem: { findMany: jest.fn().mockResolvedValue(ISSUES) },
    stockTransferItem: { findMany: jest.fn().mockResolvedValue([]) },
    stockCountItem: { findMany: jest.fn().mockResolvedValue([]) },
    material: { findMany: jest.fn().mockResolvedValue([{ id: "M1", code: "VT-M1", name: "Vật tư M1", unit: "cái", accountingClass: "RAW_MATERIAL" }]) },
    warehouse: { findMany: jest.fn().mockResolvedValue([{ id: "W1", code: "KHO1", name: "Kho chính" }]), count: jest.fn().mockResolvedValue(1) },
    stockReceipt: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    stockIssue: { count: jest.fn().mockResolvedValue(0) },
    stockTransfer: { count: jest.fn().mockResolvedValue(0) },
    stockCount: { count: jest.fn().mockResolvedValue(0) },
    stockIssueLotConsumption: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    ...overrides
  };
  return prisma;
}

describe("InventoryReportsService", () => {
  describe("contract + masking", () => {
    it("returns { meta, data, page } with the documented meta fields", async () => {
      const prisma = makePrisma();
      const service = new InventoryReportsService(prisma as unknown as PrismaService);
      const query = stockLedgerQuerySchema.parse({ materialId: "M1", fromDate: "2026-02-01", toDate: "2026-04-30" });
      const res = await service.stockLedger(query, admin);

      expect(Object.keys(res).sort()).toEqual(["data", "meta", "page"]);
      expect(res.meta).toMatchObject({
        costMethod: "AVERAGE",
        periodLockedUntil: null,
        costVisible: true,
        schemaVersion: "1.0",
        period: { from: "2026-02-01", to: "2026-04-30" },
        filters: { materialId: "M1", fromDate: "2026-02-01", toDate: "2026-04-30" }
      });
      expect(typeof res.meta.generatedAt).toBe("string");
      expect(res.page).toEqual({ page: 1, limit: 100, total: 3, totalPages: 1 });
    });

    it("ledger: opening/closing, invoice fields and source lot per line", async () => {
      const service = new InventoryReportsService(makePrisma() as unknown as PrismaService);
      const res = await service.stockLedger(
        stockLedgerQuerySchema.parse({ materialId: "M1", fromDate: "2026-02-01", toDate: "2026-04-30" }),
        admin
      );
      const accounts = res.meta["accounts"] as Array<Record<string, number>>;
      // Opening = 10 on hand valued at 100k avg; closing = 20 x 135k
      expect(accounts[0]).toMatchObject({ openingQty: 10, openingValue: 1_000_000, inQty: 15, outQty: 5, closingQty: 20, closingValue: 2_700_000 });

      const [feb, mar, apr] = res.data;
      expect(feb).toMatchObject({ eventType: "RECEIPT", qtyIn: 10, unitPrice: 140_000, amount: 1_400_000, balanceQty: 20, invoiceNumber: "0000123", sellerTaxCode: "0312345678" });
      expect(mar).toMatchObject({ eventType: "ISSUE", qtyOut: 5, unitPrice: 120_000, amount: 600_000, balanceQty: 15, sourceReceiptLotId: "LOT1", invoiceSeries: "C26TAA", supplier: "NCC A" });
      expect(apr).toMatchObject({ eventType: "RECEIPT", qtyIn: 5, balanceQty: 20, balanceValue: 2_700_000 });
    });

    it("cancelled issue shows issue + reversal lines and its auto return receipt is not counted twice", async () => {
      const cancelledIssue = {
        ...ISSUES[0],
        issue: { ...ISSUES[0].issue, status: "CANCELLED", cancelledAt: day("2026-03-05") }
      };
      const autoReturn = {
        ...receiptItem("rr1", "2026-03-05", 5, 120_000, "PN-RET"),
        receipt: { ...receiptItem("rr1", "2026-03-05", 5, 120_000, "PN-RET").receipt, receiptType: "RETURN_FROM_PROJECT", returnedFromIssue: { status: "CANCELLED" } }
      };
      const prisma = makePrisma({
        stockReceiptItem: { findMany: jest.fn().mockResolvedValue([RECEIPTS[0], RECEIPTS[1], autoReturn]), count: jest.fn() },
        stockIssueItem: { findMany: jest.fn().mockResolvedValue([cancelledIssue]) }
      });
      const service = new InventoryReportsService(prisma as unknown as PrismaService);
      const res = await service.stockLedger(
        stockLedgerQuerySchema.parse({ materialId: "M1", fromDate: "2026-03-01", toDate: "2026-03-31" }),
        admin
      );
      expect(res.data.map((l) => l["eventType"])).toEqual(["ISSUE", "ISSUE_REVERSAL"]);
      expect(res.data[1]).toMatchObject({ qtyIn: 5, balanceQty: 20, reversal: true });
    });

    it("nulls every cost field when the caller lacks inventory.view_cost", async () => {
      const service = new InventoryReportsService(makePrisma() as unknown as PrismaService);
      const res = await service.stockLedger(
        stockLedgerQuerySchema.parse({ materialId: "M1", fromDate: "2026-02-01", toDate: "2026-04-30" }),
        noCost
      );
      expect(res.meta.costVisible).toBe(false);
      for (const line of res.data) {
        expect(line["unitPrice"]).toBeNull();
        expect(line["amount"]).toBeNull();
        expect(line["balanceValue"]).toBeNull();
        expect(line["qtyIn"] === 0 || typeof line["qtyIn"] === "number").toBe(true);
      }
      const account = (res.meta["accounts"] as Array<Record<string, unknown>>)[0];
      expect(account["openingValue"]).toBeNull();
      expect(account["closingValue"]).toBeNull();
      expect(account["closingQty"]).toBe(20);
      const sources = (res.data[1]["sources"] as Array<Record<string, unknown>>);
      expect(sources[0]["lotUnitPrice"]).toBeNull();
    });

    it("paginates the ledger lines", async () => {
      const service = new InventoryReportsService(makePrisma() as unknown as PrismaService);
      const q = { materialId: "M1", fromDate: "2026-01-01", toDate: "2026-04-30", limit: 2 };
      const p1 = await service.stockLedger(stockLedgerQuerySchema.parse({ ...q, page: 1 }), admin);
      const p2 = await service.stockLedger(stockLedgerQuerySchema.parse({ ...q, page: 2 }), admin);
      expect(p1.page).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
      expect(p1.data).toHaveLength(2);
      expect(p2.data).toHaveLength(2);
      const ids = [...p1.data, ...p2.data].map((l) => l["lineId"]);
      expect(new Set(ids).size).toBe(4);
    });

    it("rejects limit above 500 and defaults to 100", () => {
      expect(() => stockLedgerQuerySchema.parse({ fromDate: "2026-01-01", toDate: "2026-02-01", limit: 501 })).toThrow();
      expect(stockLedgerQuerySchema.parse({ fromDate: "2026-01-01", toDate: "2026-02-01" }).limit).toBe(100);
    });
  });

  describe("project cost", () => {
    function projectPrisma() {
      return makePrisma({
        project: {
          findFirst: jest.fn().mockResolvedValue({ id: "P1", code: "DA-1", name: "Dự án 1", status: "IN_PROGRESS" }),
          findUnique: jest.fn().mockResolvedValue({ id: "P1", code: "DA-1", name: "Dự án 1", costRecognitionStatus: "IN_PROGRESS" })
        },
        stockIssueItem: {
          findMany: jest.fn().mockResolvedValue(
            ISSUES.map((i) => ({ ...i, material: { code: "VT-M1", name: "Vật tư M1", unit: "cái" } }))
          )
        },
        stockReceiptItem: { findMany: jest.fn().mockResolvedValue([]) },
        projectCost: {
          groupBy: jest.fn().mockResolvedValue([
            { projectId: "P1", group: "SHIPPING", _sum: { amount: new Decimal(300_000) }, _count: { _all: 2 } },
            { projectId: "P1", group: "LABOR", _sum: { amount: new Decimal(1_000_000) }, _count: { _all: 1 } }
          ]),
          findMany: jest.fn().mockResolvedValue([])
        }
      });
    }
    const admin2 = admin;

    it("values materials at the recorded issue price and adds direct costs by group", async () => {
      const service = new InventoryReportsService(projectPrisma() as unknown as PrismaService);
      const res = await service.projectCost(projectCostQuerySchema.parse({ projectId: "P1" }), admin2);
      expect(res.page).toEqual({ page: 1, limit: 100, total: 1, totalPages: 1 });
      expect(res.data[0]).toMatchObject({
        projectId: "P1", materialCost: 600_000, returnedCost: 0, netMaterialCost: 600_000, directCost: 1_300_000, totalCost: 1_900_000
      });
      // Groups come back in CostGroup order (LABOR before SHIPPING)
      expect((res.data[0]["directCostByGroup"] as Array<{ group: string }>).map((g) => g.group)).toEqual(["LABOR", "SHIPPING"]);
      const lines = res.data[0]["materialLines"] as Array<{ unitPrice: number; amount: number; sources: Array<{ invoiceNumber: string }> }>;
      expect(lines[0]).toMatchObject({ unitPrice: 120_000, amount: 600_000 });
      expect(lines[0].sources[0].invoiceNumber).toBe("0000123");
    });

    it("masks costs without inventory.view_cost", async () => {
      const service = new InventoryReportsService(projectPrisma() as unknown as PrismaService);
      const res = await service.projectCost(projectCostQuerySchema.parse({ projectId: "P1" }), noCost);
      expect(res.data[0]["materialCost"]).toBeNull();
      expect(res.data[0]["totalCost"]).toBeNull();
      expect((res.data[0]["directCostByGroup"] as Array<{ amount: unknown }>)[0].amount).toBeNull();
      expect((res.meta["totals"] as { totalCost: unknown }).totalCost).toBeNull();
    });
  });

  describe("inventory valuation", () => {
    const balances = [
      balancesRow("M1", 20, 135_000, "RAW_MATERIAL"),
      balancesRow("M2", 3.333, 1_001, "TOOL"),
      balancesRow("M3", 7, 2_500, null)
    ];

    it("today equals get_inventory_summary total exactly", async () => {
      const prisma = makePrisma({
        stockBalance: { findMany: jest.fn().mockResolvedValue(balances) },
        material: { findMany: jest.fn().mockResolvedValue([]) }
      });
      const reports = new InventoryReportsService(prisma as unknown as PrismaService);
      const summary = await new InventoryBalanceService(prisma as unknown as PrismaService).getSummary();
      const res = await reports.inventoryValuation(inventoryValuationQuerySchema.parse({}), admin);

      expect(res.meta["valuationMethod"]).toBe("LIVE_COST_PRICE");
      const totals = res.meta["totals"] as { totalValue: number; unclassifiedMaterialCount: number };
      expect(totals.totalValue).toBe(summary.totalValue);
      expect(totals.totalValue).toBe(Math.round(20 * 135_000 + 3.333 * 1_001 + 7 * 2_500));
      expect(totals.unclassifiedMaterialCount).toBe(1);
      expect(res.meta["asOfDate"]).toBe(new Date().toISOString().slice(0, 10));
      expect(res.data).toHaveLength(3);
    });

    it("groups by accountingClass with an unclassified bucket", async () => {
      const prisma = makePrisma({ stockBalance: { findMany: jest.fn().mockResolvedValue(balances) } });
      const reports = new InventoryReportsService(prisma as unknown as PrismaService);
      const res = await reports.inventoryValuation(inventoryValuationQuerySchema.parse({ groupBy: "accountingClass" }), admin);
      expect(res.data.map((g) => g["accountingClass"])).toEqual(["RAW_MATERIAL", "TOOL", null]);
      expect(res.data[0]).toMatchObject({ account: "152", value: 2_700_000 });
      expect(res.data[2]).toMatchObject({ label: "Chưa phân loại", value: 17_500 });
    });

    it("masks values without inventory.view_cost", async () => {
      const prisma = makePrisma({ stockBalance: { findMany: jest.fn().mockResolvedValue(balances) } });
      const reports = new InventoryReportsService(prisma as unknown as PrismaService);
      const res = await reports.inventoryValuation(inventoryValuationQuerySchema.parse({}), noCost);
      expect(res.meta.costVisible).toBe(false);
      expect((res.meta["totals"] as { totalValue: unknown }).totalValue).toBeNull();
      expect(res.data[0]["value"]).toBeNull();
      expect(res.data[0]["costPrice"]).toBeNull();
      expect(res.data[0]["quantity"]).toBe(20);
    });

    it("replays confirmed movements for a past date", async () => {
      const prisma = makePrisma({ stockBalance: { findMany: jest.fn().mockResolvedValue([balancesRow("M1", 20, 135_000, "RAW_MATERIAL")]) } });
      const reports = new InventoryReportsService(prisma as unknown as PrismaService);
      const at = async (asOfDate: string) => {
        const res = await reports.inventoryValuation(inventoryValuationQuerySchema.parse({ asOfDate }), admin);
        return res;
      };

      const jan = await at("2026-01-31");
      expect((jan.meta["totals"] as { totalValue: number }).totalValue).toBe(1_000_000); // 10 x 100k
      expect(jan.meta["valuationMethod"]).toBe("REPLAY_MOVING_AVERAGE");

      const feb = await at("2026-02-15");
      expect((feb.meta["totals"] as { totalValue: number }).totalValue).toBe(2_400_000); // 20 x 120k
      expect(feb.data[0]).toMatchObject({ quantity: 20, costPrice: 120_000 });

      const mar = await at("2026-03-15");
      expect((mar.meta["totals"] as { totalValue: number }).totalValue).toBe(1_800_000); // 15 x 120k

      // Replay up to now matches the live balance/costPrice => no reconciliation difference.
      expect(mar.meta["reconciliationDiff"]).toBe(0);
    });

    it("reports a reconciliation difference when the replay does not match the live costPrice", async () => {
      const prisma = makePrisma({ stockBalance: { findMany: jest.fn().mockResolvedValue([balancesRow("M1", 20, 130_000, "RAW_MATERIAL")]) } });
      const reports = new InventoryReportsService(prisma as unknown as PrismaService);
      const res = await reports.inventoryValuation(inventoryValuationQuerySchema.parse({ asOfDate: "2026-03-15" }), admin);
      expect(res.meta["reconciliationDiff"]).toBe(100_000);
      expect((res.meta["warnings"] as string[]).length).toBeGreaterThan(0);
    });
  });
});

describe("ReceiptReportsService", () => {
  it("receipts-without-invoice is paginated and lists missing fields", async () => {
    const rows = Array.from({ length: 2 }, (_, i) => ({
      id: `R${i}`, receiptNo: `PN-${i}`, date: day("2026-01-10"), warehouseId: "W1", totalAmount: new Decimal(1_000_000), purchaseInvoiceNo: null, confirmedAt: day("2026-01-10"),
      invoiceSeries: null, invoiceNumber: null, invoiceDate: null, sellerTaxCode: null,
      supplier: { id: "S1", name: "NCC A", taxCode: "0312345678" }, warehouse: { code: "KHO1", name: "Kho" }, _count: { items: 3 }
    }));
    const prisma = makePrisma({ stockReceipt: { count: jest.fn().mockResolvedValue(62), findMany: jest.fn().mockResolvedValue(rows) } });
    const service = new ReceiptReportsService(prisma as unknown as PrismaService);
    const res = await service.receiptsWithoutInvoice(
      { mode: "NUMBER", page: 2, limit: 2 } as Parameters<ReceiptReportsService["receiptsWithoutInvoice"]>[0],
      admin
    );

    expect(res.page).toEqual({ page: 2, limit: 2, total: 62, totalPages: 31 });
    expect(res.meta["missingCount"]).toBe(62);
    expect(res.data[0]["missingFields"]).toEqual(["invoiceNumber", "invoiceSeries", "invoiceDate"]);
    const call = prisma.stockReceipt.findMany.mock.calls[0][0] as { skip: number; take: number; where: { status: string; receiptType: string } };
    expect(call).toMatchObject({ skip: 2, take: 2, where: { status: "CONFIRMED", receiptType: "PURCHASE" } });

    const hidden = await service.receiptsWithoutInvoice({ mode: "NUMBER", page: 1, limit: 2 } as Parameters<ReceiptReportsService["receiptsWithoutInvoice"]>[0], noCost);
    expect(hidden.data[0]["totalAmount"]).toBeNull();
  });

  it("invoice-date-warnings compares lot invoice date with the sales invoice date", async () => {
    const rows = [
      {
        id: "C1", stockLotId: "LOT9", quantity: new Decimal(2), lotUnitPrice: new Decimal(140_000),
        issueItem: {
          id: "ii", material: { id: "M1", code: "VT1", name: "Vật tư 1", unit: "cái" },
          issue: { id: "I1", issueNo: "PX-1", date: day("2026-03-01"), status: "CONFIRMED", warehouseId: "W1", project: { id: "P1", code: "DA-1", name: "Dự án 1", salesInvoiceDate: day("2026-03-05") }, allocation: null }
        },
        stockLot: { purchaseInvoiceDate: day("2026-03-10"), purchaseInvoiceNo: null, stockReceiptItem: { receipt: receiptRef } }
      }
    ];
    const prisma = makePrisma({ stockIssueLotConsumption: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue(rows) } });
    const service = new ReceiptReportsService(prisma as unknown as PrismaService);
    const res = await service.invoiceDateWarnings({ page: 1, limit: 100 } as Parameters<ReceiptReportsService["invoiceDateWarnings"]>[0], admin);
    expect(res.data[0]).toMatchObject({ daysPurchaseAfterSale: 5, salesDateBasis: "SALES_INVOICE", sourceReceiptLotId: "LOT9", amount: 280_000 });
    const where = (prisma.stockIssueLotConsumption.findMany.mock.calls[0][0] as { where: { invoiceDateWarning: boolean } }).where;
    expect(where.invoiceDateWarning).toBe(true);
  });

  it("unallocated-receipts excludes CONSUMABLE_COMMON by default and reports remaining value", async () => {
    const rows = [
      {
        id: "ri1", quantity: new Decimal(10), unitPrice: new Decimal(100_000), total: new Decimal(1_000_000),
        material: { id: "M1", code: "VT1", name: "Vật tư 1", unit: "cái", accountingClass: "RAW_MATERIAL" },
        stockLots: [{ id: "L1", remainingQuantity: new Decimal(4), unitPrice: new Decimal(100_000) }],
        receipt: { ...receiptRef, date: day("2026-01-10"), warehouseId: "W1", warehouse: { code: "KHO1", name: "Kho" } }
      }
    ];
    const prisma = makePrisma({ stockReceiptItem: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue(rows) } });
    const service = new ReceiptReportsService(prisma as unknown as PrismaService);
    const res = await service.unallocatedReceipts({ page: 1, limit: 100 } as Parameters<ReceiptReportsService["unallocatedReceipts"]>[0], admin);
    expect(res.data[0]).toMatchObject({ remainingQuantity: 4, remainingValue: 400_000 });
    const where = (prisma.stockReceiptItem.count.mock.calls[0][0] as { where: { projectId: null; material: unknown } }).where;
    expect(where.projectId).toBeNull();
    expect(JSON.stringify(where.material)).toContain("CONSUMABLE_COMMON");
  });
});
