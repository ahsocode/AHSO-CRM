import { Decimal } from "@prisma/client/runtime/library";
import { replayMovements, type MovementEvent, type MovementKind } from "./movement-replay";

const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

function ev(
  id: string,
  kind: MovementKind,
  date: string,
  quantity: number,
  extra: Partial<MovementEvent<undefined>> = {}
): MovementEvent<undefined> {
  return {
    id,
    kind,
    materialId: "M1",
    warehouseId: "W1",
    eventDate: day(date),
    sortAt: day(date),
    quantity: new Decimal(quantity),
    unitPrice: null,
    recordedValue: null,
    valueAdjustment: null,
    meta: undefined,
    ...extra
  };
}

const receipt = (id: string, date: string, quantity: number, price: number) =>
  ev(id, "RECEIPT", date, quantity, { unitPrice: new Decimal(price), recordedValue: new Decimal(quantity * price) });

describe("replayMovements (moving average)", () => {
  it("10 x 100k then 10 x 140k gives 120k; issue 5 keeps avg and values at issue price", () => {
    const { events, materials } = replayMovements([
      receipt("a", "2026-01-10", 10, 100_000),
      receipt("b", "2026-02-10", 10, 140_000),
      ev("c", "ISSUE", "2026-03-01", -5, { recordedValue: new Decimal(600_000) })
    ]);
    expect(events[1].avgAfter.toNumber()).toBe(120_000);
    expect(events[2].value.toNumber()).toBe(600_000);
    expect(events[2].unitCost.toNumber()).toBe(120_000);
    expect(materials.get("M1")?.avg.toNumber()).toBe(120_000);
    expect(materials.get("M1")?.qty.toNumber()).toBe(15);
  });

  it("receipt of 5 x 180k at stock 15 gives 135k", () => {
    const { materials } = replayMovements([
      receipt("a", "2026-01-10", 10, 100_000),
      receipt("b", "2026-02-10", 10, 140_000),
      ev("c", "ISSUE", "2026-03-01", -5, { recordedValue: new Decimal(600_000) }),
      receipt("d", "2026-04-01", 5, 180_000)
    ]);
    expect(materials.get("M1")?.avg.toNumber()).toBe(135_000);
    expect(materials.get("M1")?.qty.toNumber()).toBe(20);
  });

  it("orders by date regardless of input order", () => {
    const { events } = replayMovements([receipt("b", "2026-02-10", 10, 140_000), receipt("a", "2026-01-10", 10, 100_000)]);
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("issue reversal re-enters stock at the original issue price", () => {
    const { materials } = replayMovements([
      receipt("a", "2026-01-10", 10, 100_000),
      ev("i", "ISSUE", "2026-01-20", -4, { recordedValue: new Decimal(400_000) }),
      ev("r", "ISSUE_REVERSAL", "2026-01-25", 4, { unitPrice: new Decimal(100_000), recordedValue: new Decimal(400_000) })
    ]);
    expect(materials.get("M1")?.qty.toNumber()).toBe(10);
    expect(materials.get("M1")?.avg.toNumber()).toBe(100_000);
  });

  it("transfers move quantity between warehouses without touching the average", () => {
    const { materials } = replayMovements([
      receipt("a", "2026-01-10", 10, 100_000),
      ev("t1", "TRANSFER_OUT", "2026-01-12", -4),
      ev("t2", "TRANSFER_IN", "2026-01-12", 4, { warehouseId: "W2", sortAt: day("2026-01-12") })
    ]);
    const state = materials.get("M1");
    expect(state?.byWarehouse.get("W1")?.toNumber()).toBe(6);
    expect(state?.byWarehouse.get("W2")?.toNumber()).toBe(4);
    expect(state?.avg.toNumber()).toBe(100_000);
  });

  it("price-only adjustment re-spreads the delta over current stock", () => {
    const { materials } = replayMovements([
      receipt("a", "2026-01-10", 10, 100_000),
      ev("adj", "RECEIPT_ADJUSTMENT", "2026-02-01", 0, { valueAdjustment: new Decimal(100_000) })
    ]);
    expect(materials.get("M1")?.avg.toNumber()).toBe(110_000);
  });
});
