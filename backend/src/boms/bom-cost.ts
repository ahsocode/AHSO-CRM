import { Decimal } from "@prisma/client/runtime/library";
import type { CostGroup } from "@prisma/client";

/** Display order of cost groups (mirrors frontend COST_GROUP_ORDER). */
export const COST_GROUP_ORDER: readonly CostGroup[] = [
  "MECHANICAL",
  "ELECTRICAL",
  "VISION",
  "SOFTWARE",
  "LABOR",
  "OUTSOURCE",
  "SHIPPING",
  "OTHER"
] as const;

/** Groups whose free-text lines are assumed to be stocked goods (R5). */
export const STOCK_COST_GROUPS: readonly CostGroup[] = ["MECHANICAL", "ELECTRICAL", "VISION", "OTHER"] as const;

const MAX_BOM_DEPTH = 20;

export interface CostLineInput {
  id: string;
  group: CostGroup;
  childBomId: string | null;
  quantity: Decimal.Value;
  estUnitCost: Decimal.Value;
}

export interface BomTotals {
  total: number;
  byGroup: Array<{ group: CostGroup; amount: number }>;
}

export function lineAmount(line: CostLineInput, childTotals: Map<string, number>): Decimal {
  const unit = line.childBomId ? new Decimal(childTotals.get(line.childBomId) ?? 0) : new Decimal(line.estUnitCost);
  return new Decimal(line.quantity).mul(unit).toDecimalPlaces(0);
}

/**
 * Computes totals (R6/R7) for every BOM in the graph. Sub-assembly lines cost
 * `quantity x total(child BOM)`. Cycles are guarded: a BOM already on the
 * current path contributes 0.
 */
export function computeBomGraphTotals(graph: Map<string, CostLineInput[]>): Map<string, BomTotals> {
  const memo = new Map<string, BomTotals>();

  const visit = (bomId: string, path: Set<string>): BomTotals => {
    const cached = memo.get(bomId);
    if (cached) return cached;
    if (path.has(bomId) || path.size > MAX_BOM_DEPTH) return { total: 0, byGroup: [] };

    path.add(bomId);
    const lines = graph.get(bomId) ?? [];
    const childTotals = new Map<string, number>();
    for (const line of lines) {
      if (line.childBomId && !childTotals.has(line.childBomId)) {
        childTotals.set(line.childBomId, visit(line.childBomId, path).total);
      }
    }
    path.delete(bomId);

    const groups = new Map<CostGroup, Decimal>();
    let total = new Decimal(0);
    for (const line of lines) {
      const amount = lineAmount(line, childTotals);
      total = total.plus(amount);
      groups.set(line.group, (groups.get(line.group) ?? new Decimal(0)).plus(amount));
    }

    const result: BomTotals = {
      total: total.toNumber(),
      byGroup: COST_GROUP_ORDER.filter((group) => groups.has(group)).map((group) => ({
        group,
        amount: (groups.get(group) ?? new Decimal(0)).toNumber()
      }))
    };
    // Only memoise when not inside a cycle-truncated evaluation
    memo.set(bomId, result);
    return result;
  };

  for (const bomId of graph.keys()) {
    visit(bomId, new Set());
  }
  return memo;
}

/**
 * R6: would adding `childIds` as sub-assemblies of `bomId` create a loop?
 * `childrenOf` maps bomId -> child BOM ids for the already-persisted graph.
 */
export function wouldCreateCycle(bomId: string, childIds: string[], childrenOf: Map<string, string[]>): boolean {
  const seen = new Set<string>();
  const stack = [...childIds];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === bomId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of childrenOf.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export interface StockCheckLine {
  name: string;
  group: CostGroup;
  materialId: string | null;
  childBomId: string | null;
}

/** R5: names of lines that must carry a material code before allocation / save-as-model. */
export function findLinesMissingMaterial(lines: StockCheckLine[]): string[] {
  return lines
    .filter((line) => !line.materialId && !line.childBomId && STOCK_COST_GROUPS.includes(line.group))
    .map((line) => line.name);
}
