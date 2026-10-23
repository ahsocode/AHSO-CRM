import type { CostGroup, MaterialKind, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { BomTotals, computeBomGraphTotals } from "./bom-cost";
import type { FifoBomLine } from "./fifo-suggest";

type Db = Pick<Prisma.TransactionClient, "bomLine">;

const MAX_GRAPH_DEPTH = 20;

export interface GraphLine {
  id: string;
  bomId: string;
  order: number;
  group: CostGroup;
  materialId: string | null;
  childBomId: string | null;
  name: string;
  unit: string | null;
  quantity: Decimal;
  estUnitCost: Decimal;
  material: { id: string; code: string; name: string; kind: MaterialKind } | null;
}

/** Loads the lines of `rootIds` and of every BOM reachable through sub-assemblies. */
export async function loadLineGraph(db: Db, rootIds: string[]): Promise<Map<string, GraphLine[]>> {
  const graph = new Map<string, GraphLine[]>();
  let frontier = [...new Set(rootIds)];

  for (let depth = 0; depth < MAX_GRAPH_DEPTH && frontier.length > 0; depth += 1) {
    const rows = await db.bomLine.findMany({
      where: { bomId: { in: frontier } },
      orderBy: [{ bomId: "asc" }, { order: "asc" }],
      select: {
        id: true,
        bomId: true,
        order: true,
        group: true,
        materialId: true,
        childBomId: true,
        name: true,
        unit: true,
        quantity: true,
        estUnitCost: true,
        material: { select: { id: true, code: true, name: true, kind: true } }
      }
    });
    for (const id of frontier) graph.set(id, []);
    for (const row of rows) graph.get(row.bomId)?.push(row);

    const next = new Set<string>();
    for (const row of rows) {
      if (row.childBomId && !graph.has(row.childBomId)) next.add(row.childBomId);
    }
    frontier = [...next];
  }
  return graph;
}

export function totalsFromGraph(graph: Map<string, GraphLine[]>): Map<string, BomTotals> {
  return computeBomGraphTotals(graph);
}

/** Convenience used by quotes / projects: totals for a set of BOM ids. */
export async function loadBomTotals(db: Db, bomIds: string[]): Promise<Map<string, BomTotals>> {
  if (bomIds.length === 0) return new Map();
  const graph = await loadLineGraph(db, bomIds);
  return totalsFromGraph(graph);
}

export function toFifoLine(line: GraphLine): FifoBomLine {
  return {
    id: line.id,
    group: line.group,
    name: line.name,
    unit: line.unit,
    quantity: line.quantity,
    estUnitCost: line.estUnitCost,
    materialId: line.materialId,
    materialKind: line.material?.kind ?? null,
    materialCode: line.material?.code ?? null,
    materialName: line.material?.name ?? null,
    childBomId: line.childBomId
  };
}
