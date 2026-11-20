import { Decimal } from "@prisma/client/runtime/library";

export interface MaterialAggregate {
  quantity: Decimal;
  total: Decimal;
}

export interface AdjustmentLine {
  materialId: string;
  quantity: Decimal; // signed; 0 for price-only lines
  unitPrice: Decimal;
  total: Decimal; // signed value of the line
  valueAdjustment: Decimal | null;
}

const ZERO = new Decimal(0);

export function addToAggregate(map: Map<string, MaterialAggregate>, materialId: string, quantity: Decimal.Value, total: Decimal.Value) {
  const current = map.get(materialId) ?? { quantity: ZERO, total: ZERO };
  map.set(materialId, { quantity: current.quantity.plus(quantity), total: current.total.plus(total) });
}

/**
 * Difference between the effective original state and the replacement/adjustment invoice, per material.
 * - quantity delta  -> signed quantity line (negative = returned to supplier)
 * - price-only delta on the common quantity -> valueAdjustment line (quantity 0)
 * Materials missing from the new invoice are only reduced for REPLACEMENT (full re-issue).
 */
export function computeAdjustmentLines(
  original: Map<string, MaterialAggregate>,
  next: Map<string, MaterialAggregate>,
  isReplacement: boolean
): { lines: AdjustmentLine[]; untouchedMaterialIds: string[] } {
  const lines: AdjustmentLine[] = [];
  const untouched: string[] = [];
  const ids = new Set<string>([...original.keys(), ...next.keys()]);

  for (const materialId of ids) {
    const o = original.get(materialId) ?? { quantity: ZERO, total: ZERO };
    let n = next.get(materialId);
    if (!n) {
      if (!isReplacement) {
        untouched.push(materialId);
        continue;
      }
      n = { quantity: ZERO, total: ZERO };
    }
    const po = o.quantity.greaterThan(0) ? o.total.div(o.quantity) : ZERO;
    const pn = n.quantity.greaterThan(0) ? n.total.div(n.quantity) : ZERO;
    const dq = n.quantity.minus(o.quantity);

    if (dq.greaterThan(0)) {
      lines.push({ materialId, quantity: dq, unitPrice: pn.toDecimalPlaces(0), total: dq.mul(pn).toDecimalPlaces(0), valueAdjustment: null });
    } else if (dq.lessThan(0)) {
      lines.push({ materialId, quantity: dq, unitPrice: po.toDecimalPlaces(0), total: dq.mul(po).toDecimalPlaces(0), valueAdjustment: null });
    }

    const common = Decimal.min(o.quantity, n.quantity);
    if (common.greaterThan(0)) {
      const delta = common.mul(pn).minus(common.mul(po)).toDecimalPlaces(0);
      if (!delta.isZero()) {
        lines.push({ materialId, quantity: ZERO, unitPrice: ZERO, total: delta, valueAdjustment: delta });
      }
    }
  }
  return { lines, untouchedMaterialIds: untouched };
}
