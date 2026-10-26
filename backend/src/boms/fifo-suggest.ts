import { invoiceDayEnd } from "../common/utils/invoice-date";
import { Decimal } from "@prisma/client/runtime/library";
import type { CostGroup } from "@prisma/client";
import { STOCK_COST_GROUPS } from "./bom-cost";

const MAX_EXPANSION_DEPTH = 20;
const QTY_DP = 3;

export interface FifoBomLine {
  id: string;
  group: CostGroup;
  name: string;
  unit: string | null;
  quantity: Decimal.Value;
  estUnitCost: Decimal.Value;
  materialId: string | null;
  materialKind: "STOCK" | "SERVICE" | "PRODUCT" | null;
  materialCode: string | null;
  materialName: string | null;
  childBomId: string | null;
}

export interface StockDemand {
  /** Top-level line of the root BOM this demand rolls up into. */
  bomLineId: string;
  materialId: string;
  code: string | null;
  name: string;
  unit: string | null;
  quantity: Decimal;
}

export interface ServiceDemand {
  bomLineId: string;
  group: CostGroup;
  name: string;
  quantity: number;
  estimatedAmount: number;
}

export interface ExpandedDemand {
  stock: StockDemand[];
  services: ServiceDemand[];
}

/**
 * Explodes a BOM (recursively through sub-assemblies) into material demands.
 * Every demand is attributed to the top-level line of the root BOM so that
 * "already allocated" can be subtracted per bomLineId.
 */
export function expandBomDemand(
  rootLines: FifoBomLine[],
  linesByBomId: Map<string, FifoBomLine[]>,
  multiplier = 1
): ExpandedDemand {
  const stock = new Map<string, StockDemand>();
  const services = new Map<string, ServiceDemand>();

  const walk = (lines: FifoBomLine[], factor: Decimal, topLineId: string | null, depth: number, path: string[]) => {
    for (const line of lines) {
      const topId = topLineId ?? line.id;
      const qty = new Decimal(line.quantity).mul(factor);

      if (line.childBomId) {
        if (depth >= MAX_EXPANSION_DEPTH || path.includes(line.childBomId)) continue;
        walk(linesByBomId.get(line.childBomId) ?? [], qty, topId, depth + 1, [...path, line.childBomId]);
        continue;
      }

      const isService =
        line.materialKind === "SERVICE" || (!line.materialId && !STOCK_COST_GROUPS.includes(line.group));
      if (isService) {
        const key = `${topId}:${line.id}`;
        const previous = services.get(key);
        const amount = qty.mul(new Decimal(line.estUnitCost)).toDecimalPlaces(0).toNumber();
        services.set(key, {
          bomLineId: topId,
          group: line.group,
          name: line.name,
          quantity: (previous ? new Decimal(previous.quantity).plus(qty) : qty).toDecimalPlaces(QTY_DP).toNumber(),
          estimatedAmount: (previous?.estimatedAmount ?? 0) + amount
        });
        continue;
      }

      if (!line.materialId || line.materialKind !== "STOCK") continue; // guarded by R5 before expansion

      const key = `${topId}:${line.materialId}`;
      const previous = stock.get(key);
      stock.set(key, {
        bomLineId: topId,
        materialId: line.materialId,
        code: line.materialCode,
        name: line.materialName ?? line.name,
        unit: line.unit,
        quantity: previous ? previous.quantity.plus(qty) : qty
      });
    }
  };

  walk(rootLines, new Decimal(multiplier), null, 0, []);
  return {
    stock: [...stock.values()].map((demand) => ({ ...demand, quantity: demand.quantity.toDecimalPlaces(QTY_DP) })),
    services: [...services.values()]
  };
}

export interface FifoLot {
  id: string;
  materialId: string;
  warehouseId: string;
  purchaseInvoiceDate: Date;
  createdAt: Date;
  remainingQuantity: Decimal.Value;
  unitPrice: Decimal.Value;
}

export interface FifoSuggestInput {
  demands: StockDemand[];
  lots: FifoLot[];
  salesInvoiceDate: Date;
  /** Quantity already allocated in CONFIRMED allocations, keyed `${bomLineId}:${materialId}`. */
  allocated?: Map<string, Decimal.Value>;
  /** Quantity held by DRAFT allocations per lot id. */
  reservedByLot?: Map<string, Decimal.Value>;
}

export interface SuggestedItem {
  stockLotId: string;
  warehouseId: string;
  materialId: string;
  bomLineId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Per-BOM-line split when one lot serves several lines (the allocation unique key is per lot). */
  breakdown: Array<{ bomLineId: string; quantity: number }>;
}

export interface Shortage {
  materialId: string;
  bomLineId: string;
  code: string | null;
  name: string;
  unit: string | null;
  requiredQty: number;
  allocatedQty: number;
  missingQty: number;
}

export interface FifoSuggestResult {
  items: SuggestedItem[];
  shortages: Shortage[];
}

export function demandKey(bomLineId: string, materialId: string) {
  return `${bomLineId}:${materialId}`;
}

/** Pure FIFO suggestion (spec §4). Does not touch the database. */
export function suggestFifo(input: FifoSuggestInput): FifoSuggestResult {
  const salesTime = invoiceDayEnd(input.salesInvoiceDate).getTime();

  const eligibleByMaterial = new Map<string, Array<FifoLot & { available: Decimal }>>();
  const sortedLots = [...input.lots].sort(
    (a, b) =>
      a.purchaseInvoiceDate.getTime() - b.purchaseInvoiceDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
  );
  for (const lot of sortedLots) {
    if (lot.purchaseInvoiceDate.getTime() > salesTime) continue;
    const available = new Decimal(lot.remainingQuantity).minus(input.reservedByLot?.get(lot.id) ?? 0);
    if (available.lte(0)) continue;
    const list = eligibleByMaterial.get(lot.materialId) ?? [];
    list.push({ ...lot, available });
    eligibleByMaterial.set(lot.materialId, list);
  }

  const itemsByLot = new Map<string, SuggestedItem>();
  const shortages: Shortage[] = [];

  for (const demand of input.demands) {
    const alreadyAllocated = new Decimal(input.allocated?.get(demandKey(demand.bomLineId, demand.materialId)) ?? 0);
    let remaining = demand.quantity.minus(alreadyAllocated);
    const required = Decimal.max(remaining, 0);
    if (remaining.lte(0)) continue;

    for (const lot of eligibleByMaterial.get(demand.materialId) ?? []) {
      if (remaining.lte(0)) break;
      if (lot.available.lte(0)) continue;
      const take = Decimal.min(lot.available, remaining);
      lot.available = lot.available.minus(take);
      remaining = remaining.minus(take);

      const unitPrice = new Decimal(lot.unitPrice);
      const existing = itemsByLot.get(lot.id);
      if (existing) {
        const quantity = new Decimal(existing.quantity).plus(take);
        existing.quantity = quantity.toNumber();
        existing.total = quantity.mul(unitPrice).toDecimalPlaces(0).toNumber();
        const part = existing.breakdown.find((entry) => entry.bomLineId === demand.bomLineId);
        if (part) part.quantity = new Decimal(part.quantity).plus(take).toNumber();
        else existing.breakdown.push({ bomLineId: demand.bomLineId, quantity: take.toNumber() });
      } else {
        itemsByLot.set(lot.id, {
          stockLotId: lot.id,
          warehouseId: lot.warehouseId,
          materialId: lot.materialId,
          bomLineId: demand.bomLineId,
          quantity: take.toNumber(),
          unitPrice: unitPrice.toNumber(),
          total: take.mul(unitPrice).toDecimalPlaces(0).toNumber(),
          breakdown: [{ bomLineId: demand.bomLineId, quantity: take.toNumber() }]
        });
      }
    }

    if (remaining.gt(0)) {
      shortages.push({
        materialId: demand.materialId,
        bomLineId: demand.bomLineId,
        code: demand.code,
        name: demand.name,
        unit: demand.unit,
        requiredQty: required.toNumber(),
        allocatedQty: required.minus(remaining).toNumber(),
        missingQty: remaining.toNumber()
      });
    }
  }

  return { items: [...itemsByLot.values()], shortages };
}
