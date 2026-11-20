import { Decimal } from "@prisma/client/runtime/library";

/**
 * Pure replay of confirmed stock movements in chronological order using the same
 * moving-average formula as InventoryBalanceService.updateAverageCostPrice:
 *   avg' = round0((stockBefore * avg + qtyIn * priceIn) / (stockBefore + qtyIn))
 * Only receipts (and issue reversals) change the average; issues, transfers and counts move quantity only.
 * No database access here so the maths can be tested in isolation.
 */
export type MovementKind =
  | "RECEIPT"
  | "RECEIPT_ADJUSTMENT"
  | "ISSUE"
  | "ISSUE_REVERSAL"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "COUNT_ADJUSTMENT";

export interface MovementEvent<M = undefined> {
  /** Stable unique id for deterministic tie-breaking (document line id + suffix). */
  id: string;
  kind: MovementKind;
  materialId: string;
  warehouseId: string;
  /** Business date used for ordering and "as of" cut-off. */
  eventDate: Date;
  /** Secondary ordering (confirmation time); falls back to eventDate. */
  sortAt: Date;
  /** Signed quantity: positive = stock in, negative = stock out. */
  quantity: Decimal;
  /** Price per unit for inbound events that feed the average (receipts, reversals). */
  unitPrice: Decimal | null;
  /** Recorded line value (receipt total / issue total); null = derive from average. */
  recordedValue: Decimal | null;
  /** Price-only adjustment (quantity = 0): delta of total stock value. */
  valueAdjustment: Decimal | null;
  meta: M;
}

export interface ReplayedEvent<M = undefined> extends MovementEvent<M> {
  /** Unit cost of this movement (price for receipts, recorded/average for issues). */
  unitCost: Decimal;
  /** Value of this movement, positive magnitude (use quantity sign for direction). */
  value: Decimal;
  /** Company-wide moving average after the event. */
  avgAfter: Decimal;
  /** Quantity of this warehouse/material account after the event. */
  accountQtyAfter: Decimal;
  /** accountQtyAfter x avgAfter. */
  accountValueAfter: Decimal;
  /** Quantity of the material over all warehouses after the event. */
  materialQtyAfter: Decimal;
}

export interface MaterialState {
  qty: Decimal;
  avg: Decimal;
  byWarehouse: Map<string, Decimal>;
}

const ZERO = new Decimal(0);

export function compareEvents(a: MovementEvent<unknown>, b: MovementEvent<unknown>): number {
  return (
    a.eventDate.getTime() - b.eventDate.getTime() ||
    a.sortAt.getTime() - b.sortAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function replayMovements<M>(events: MovementEvent<M>[]): {
  events: ReplayedEvent<M>[];
  materials: Map<string, MaterialState>;
} {
  const byMaterial = new Map<string, MovementEvent<M>[]>();
  for (const event of events) {
    const list = byMaterial.get(event.materialId);
    if (list) list.push(event);
    else byMaterial.set(event.materialId, [event]);
  }

  const out: ReplayedEvent<M>[] = [];
  const materials = new Map<string, MaterialState>();

  for (const [materialId, list] of byMaterial) {
    const sorted = [...list].sort(compareEvents);
    const state: MaterialState = { qty: new Decimal(0), avg: new Decimal(0), byWarehouse: new Map() };
    materials.set(materialId, state);

    for (const event of sorted) {
      const q = new Decimal(event.quantity);
      let unitCost: Decimal;
      let value: Decimal;

      if (q.isZero() && event.valueAdjustment && !event.valueAdjustment.isZero()) {
        // Price-only adjustment: re-spread the delta over the current stock.
        const delta = new Decimal(event.valueAdjustment);
        if (state.qty.greaterThan(0)) {
          state.avg = state.qty.mul(state.avg).plus(delta).div(state.qty).toDecimalPlaces(0);
        }
        unitCost = state.avg;
        value = delta;
      } else if (q.greaterThan(0)) {
        const price = event.unitPrice ?? state.avg;
        const feedsAverage =
          event.kind === "RECEIPT" || event.kind === "RECEIPT_ADJUSTMENT" || event.kind === "ISSUE_REVERSAL";
        if (feedsAverage) {
          const totalAfter = state.qty.plus(q);
          state.avg = totalAfter.greaterThan(0)
            ? state.qty.mul(state.avg).plus(q.mul(price)).div(totalAfter).toDecimalPlaces(0)
            : new Decimal(price);
          unitCost = new Decimal(price);
          value = event.recordedValue ?? q.mul(price);
        } else {
          unitCost = state.avg;
          value = q.mul(state.avg);
        }
        state.qty = state.qty.plus(q);
      } else {
        const out = q.abs();
        if (event.kind === "ISSUE" && event.recordedValue) {
          value = new Decimal(event.recordedValue);
          unitCost = out.greaterThan(0) ? value.div(out) : state.avg;
        } else {
          unitCost = state.avg;
          value = out.mul(state.avg);
        }
        state.qty = state.qty.plus(q);
      }

      const accountQty = (state.byWarehouse.get(event.warehouseId) ?? ZERO).plus(q);
      state.byWarehouse.set(event.warehouseId, accountQty);

      out.push({
        ...event,
        unitCost,
        value,
        avgAfter: state.avg,
        accountQtyAfter: accountQty,
        accountValueAfter: accountQty.mul(state.avg),
        materialQtyAfter: state.qty
      });
    }
  }

  return { events: out, materials };
}
