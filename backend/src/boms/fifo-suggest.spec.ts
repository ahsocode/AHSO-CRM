import { Decimal } from "@prisma/client/runtime/library";
import { FifoBomLine, FifoLot, StockDemand, demandKey, expandBomDemand, suggestFifo } from "./fifo-suggest";

const lot = (id: string, materialId: string, date: string, remaining: number, unitPrice = 1000, createdAt = date): FifoLot => ({
  id,
  materialId,
  warehouseId: "wh-1",
  purchaseInvoiceDate: new Date(date),
  createdAt: new Date(createdAt),
  remainingQuantity: remaining,
  unitPrice
});

const demand = (bomLineId: string, materialId: string, qty: number): StockDemand => ({
  bomLineId,
  materialId,
  code: materialId.toUpperCase(),
  name: `Vật tư ${materialId}`,
  unit: "cái",
  quantity: new Decimal(qty)
});

const bomLine = (overrides: Partial<FifoBomLine> & { id: string }): FifoBomLine => ({
  group: "MECHANICAL",
  name: overrides.id,
  unit: "cái",
  quantity: 1,
  estUnitCost: 0,
  materialId: null,
  materialKind: "STOCK",
  materialCode: null,
  materialName: null,
  childBomId: null,
  ...overrides
});

describe("suggestFifo", () => {
  const salesDate = new Date("2026-06-30");

  it("consumes the oldest lots first and reports no shortage when stock is enough", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 12)],
      salesInvoiceDate: salesDate,
      lots: [lot("new", "m1", "2026-05-01", 10, 2000), lot("old", "m1", "2026-01-01", 8, 1000)]
    });

    expect(result.shortages).toEqual([]);
    expect(result.items.map((i) => [i.stockLotId, i.quantity, i.total])).toEqual([
      ["old", 8, 8000],
      ["new", 4, 8000]
    ]);
  });

  it("breaks purchase-date ties by createdAt", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 1)],
      salesInvoiceDate: salesDate,
      lots: [
        lot("b", "m1", "2026-01-01", 5, 1000, "2026-01-01T10:00:00Z"),
        lot("a", "m1", "2026-01-01", 5, 1000, "2026-01-01T08:00:00Z")
      ]
    });
    expect(result.items[0].stockLotId).toBe("a");
  });

  it("reports a shortage with the missing quantity", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 10)],
      salesInvoiceDate: salesDate,
      lots: [lot("a", "m1", "2026-01-01", 6)]
    });

    expect(result.items).toHaveLength(1);
    expect(result.shortages).toEqual([
      expect.objectContaining({ materialId: "m1", requiredQty: 10, allocatedQty: 6, missingQty: 4 })
    ]);
  });

  it("ignores lots purchased after the sales invoice date (R9)", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 5)],
      salesInvoiceDate: salesDate,
      lots: [lot("late", "m1", "2026-07-01", 100)]
    });

    expect(result.items).toEqual([]);
    expect(result.shortages[0].missingQty).toBe(5);
  });

  it("includes purchases later on the same calendar invoice date", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 5)], salesInvoiceDate: salesDate,
      lots: [lot("same-day", "m1", "2026-06-30T16:00:00Z", 5), lot("next-day", "m1", "2026-07-01", 100)]
    });
    expect(result.items.map((item) => item.stockLotId)).toEqual(["same-day"]);
    expect(result.shortages).toEqual([]);
  });

  it("subtracts quantity already allocated in confirmed allocations", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 10)],
      salesInvoiceDate: salesDate,
      lots: [lot("a", "m1", "2026-01-01", 100)],
      allocated: new Map([[demandKey("l1", "m1"), 7]])
    });

    expect(result.items[0].quantity).toBe(3);
    expect(result.shortages).toEqual([]);
  });

  it("skips a demand that is fully covered by earlier allocations", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 5)],
      salesInvoiceDate: salesDate,
      lots: [lot("a", "m1", "2026-01-01", 100)],
      allocated: new Map([[demandKey("l1", "m1"), 5]])
    });
    expect(result.items).toEqual([]);
    expect(result.shortages).toEqual([]);
  });

  it("does not count quantity reserved by other draft allocations", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 10)],
      salesInvoiceDate: salesDate,
      lots: [lot("a", "m1", "2026-01-01", 10)],
      reservedByLot: new Map([["a", 4]])
    });

    expect(result.items[0].quantity).toBe(6);
    expect(result.shortages[0].missingQty).toBe(4);
  });

  it("merges one lot shared by two BOM lines into a single item with a breakdown", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 3), demand("l2", "m1", 2)],
      salesInvoiceDate: salesDate,
      lots: [lot("a", "m1", "2026-01-01", 10)]
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(5);
    expect(result.items[0].breakdown).toEqual([
      { bomLineId: "l1", quantity: 3 },
      { bomLineId: "l2", quantity: 2 }
    ]);
  });

  it("keeps decimals exact", () => {
    const result = suggestFifo({
      demands: [demand("l1", "m1", 0.3)],
      salesInvoiceDate: salesDate,
      lots: [lot("a", "m1", "2026-01-01", 0.1), lot("b", "m1", "2026-02-01", 0.2)]
    });
    expect(result.shortages).toEqual([]);
    expect(result.items.map((i) => i.quantity)).toEqual([0.1, 0.2]);
  });
});

describe("expandBomDemand", () => {
  it("does not allocate finished products as stocked components", () => {
    const result = expandBomDemand([bomLine({ id: "product", materialId: "prod", materialKind: "PRODUCT" })], new Map());
    expect(result.stock).toEqual([]);
  });
  it("expands sub-assemblies, multiplies quantities and attributes demand to the top-level line", () => {
    const root = [
      bomLine({ id: "top-1", materialId: "m1", materialCode: "M1", materialName: "Vít", quantity: 4 }),
      bomLine({ id: "top-2", childBomId: "child", quantity: 2 })
    ];
    const child = [bomLine({ id: "c-1", materialId: "m2", materialCode: "M2", materialName: "Motor", quantity: 3 })];

    const result = expandBomDemand(root, new Map([["child", child]]), 5);

    expect(result.stock.map((d) => [d.bomLineId, d.materialId, d.quantity.toNumber()])).toEqual([
      ["top-1", "m1", 20],
      ["top-2", "m2", 30]
    ]);
  });

  it("routes SERVICE materials and free service-group lines to serviceLines", () => {
    const root = [
      bomLine({ id: "s1", group: "SOFTWARE", materialKind: "SERVICE", materialId: "svc", estUnitCost: 1_000_000 }),
      bomLine({ id: "s2", group: "LABOR", name: "Lắp ráp", quantity: 2, estUnitCost: 500_000 })
    ];
    const result = expandBomDemand(root, new Map());

    expect(result.stock).toEqual([]);
    expect(result.services.map((s) => [s.bomLineId, s.estimatedAmount])).toEqual([
      ["s1", 1_000_000],
      ["s2", 1_000_000]
    ]);
  });

  it("does not loop forever on a cyclic sub-assembly", () => {
    const a = [bomLine({ id: "a1", childBomId: "b" })];
    const b = [bomLine({ id: "b1", childBomId: "a" })];
    const result = expandBomDemand(a, new Map([["a", a], ["b", b]]));
    expect(result.stock).toEqual([]);
  });
});
