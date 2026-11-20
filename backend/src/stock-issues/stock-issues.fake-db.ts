import { Decimal } from "@prisma/client/runtime/library";

/**
 * Minimal in-memory stand-in for the Prisma transaction client, covering exactly the queries used by
 * stock-issue costing/cancel flows. Test support only (no jest dependency). No rollback on throw.
 */
type Where = Record<string, unknown>;
interface Args {
  where?: Where;
  data?: Where;
  select?: unknown;
  include?: unknown;
  orderBy?: unknown;
}

export interface FakeMaterial { id: string; name: string; costPrice: Decimal }
export interface FakeBalance { warehouseId: string; materialId: string; quantity: Decimal }
export interface FakeLot {
  id: string; warehouseId: string; materialId: string; purchaseInvoiceDate: Date;
  receivedQuantity: Decimal; remainingQuantity: Decimal; unitPrice: Decimal; projectId: string | null; createdAt: Date;
}
export interface FakeConsumption {
  id: string; issueItemId: string; stockLotId: string; quantity: Decimal; lotUnitPrice: Decimal; invoiceDateWarning: boolean;
}
export interface FakeIssueItem {
  id: string; issueId: string; materialId: string; quantity: Decimal; unitPrice: Decimal; total: Decimal;
}
export interface FakeIssue {
  id: string; issueNo: string; warehouseId: string; projectId: string | null; allocationId: string | null;
  date: Date; status: string; totalAmount: Decimal; createdById: string; confirmedAt: Date | null;
  cancelledAt: Date | null; cancelReason: string | null; cancelledById: string | null; deletedAt: Date | null;
  reasonType: string | null; reason: string | null; notes: string | null;
}
export interface FakeReceipt {
  id: string; receiptNo: string; warehouseId: string; status: string; receiptType: string;
  returnedFromIssueId: string | null; totalAmount: Decimal; notes: string | null;
  items: Array<{ materialId: string; quantity: Decimal; unitPrice: Decimal; total: Decimal }>;
}

const dec = (value: unknown) => new Decimal(value as Decimal.Value);

function applyNumberOp(current: Decimal, op: unknown): Decimal {
  if (op && typeof op === "object") {
    const o = op as { increment?: Decimal.Value; decrement?: Decimal.Value };
    if (o.increment !== undefined) return current.plus(o.increment);
    if (o.decrement !== undefined) return current.minus(o.decrement);
  }
  return dec(op);
}

export class FakeInventoryDb {
  settings = new Map<string, string>();
  costingConfigs: Array<{ method: "AVERAGE" | "FIFO"; effectiveFrom: Date }> = [];
  materials: FakeMaterial[] = [];
  balances: FakeBalance[] = [];
  lots: FakeLot[] = [];
  issues: FakeIssue[] = [];
  items: FakeIssueItem[] = [];
  consumptions: FakeConsumption[] = [];
  receipts: FakeReceipt[] = [];
  projects = new Map<string, { salesInvoiceDate: Date | null; costRecognitionStatus: string }>();
  allocations = new Map<string, { salesInvoiceDate: Date | null }>();
  private seq = 0;
  private nextId(prefix: string) { this.seq += 1; return `${prefix}-${this.seq}`; }

  // ── test helpers ──
  addMaterial(id: string, costPrice = 0) { this.materials.push({ id, name: `Vật tư ${id}`, costPrice: dec(costPrice) }); }
  stock(materialId: string, warehouseId = "wh") {
    return this.balances.find((b) => b.materialId === materialId && b.warehouseId === warehouseId)?.quantity.toNumber() ?? 0;
  }
  costPrice(materialId: string) { return this.materials.find((m) => m.id === materialId)!.costPrice.toNumber(); }
  lot(id: string) { return this.lots.find((l) => l.id === id)!; }

  addIssue(partial: Partial<FakeIssue> & { id: string; items: Array<{ materialId: string; quantity: number }> }) {
    const { items, ...rest } = partial;
    this.issues.push({
      issueNo: `PX-2026-${partial.id}`, warehouseId: "wh", projectId: null, allocationId: null,
      date: new Date("2026-11-20T00:00:00.000Z"), status: "DRAFT", totalAmount: dec(0), createdById: "u1",
      confirmedAt: null, cancelledAt: null, cancelReason: null, cancelledById: null, deletedAt: null,
      reasonType: null, reason: null, notes: null, ...rest,
    });
    items.forEach((item, index) => this.items.push({
      id: `${partial.id}-item-${index + 1}`, issueId: partial.id, materialId: item.materialId,
      quantity: dec(item.quantity), unitPrice: dec(0), total: dec(0),
    }));
  }

  // ── Prisma-like surface ──
  $queryRaw = async () => [];
  $executeRaw = async () => 0;
  $transaction = async <T>(fn: (tx: FakeInventoryDb) => Promise<T>): Promise<T> => fn(this);

  setting = {
    findUnique: async ({ where }: Args) => {
      const value = this.settings.get(where?.["key"] as string);
      return value === undefined ? null : { key: where?.["key"], value };
    },
  };

  inventoryCostingConfig = {
    findFirst: async ({ where }: Args) => {
      const lte = ((where?.["effectiveFrom"] as { lte?: Date } | undefined)?.lte) ?? new Date(8.64e15);
      return [...this.costingConfigs]
        .filter((c) => c.effectiveFrom.getTime() <= lte.getTime())
        .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
    },
  };

  material = {
    findUnique: async ({ where }: Args) => this.materials.find((m) => m.id === where?.["id"]) ?? null,
    findMany: async ({ where }: Args) => {
      const ids = (where?.["id"] as { in?: string[] } | undefined)?.in;
      return this.materials.filter((m) => !ids || ids.includes(m.id));
    },
    update: async ({ where, data }: Args) => {
      const m = this.materials.find((x) => x.id === where?.["id"])!;
      m.costPrice = dec(data?.["costPrice"]);
      return m;
    },
  };

  stockBalance = {
    findUnique: async ({ where }: Args) => {
      const key = where?.["warehouseId_materialId"] as { warehouseId: string; materialId: string };
      return this.balances.find((b) => b.warehouseId === key.warehouseId && b.materialId === key.materialId) ?? null;
    },
    findMany: async ({ where }: Args) => this.balances.filter((b) => !where?.["materialId"] || b.materialId === where["materialId"]),
    updateMany: async ({ where, data }: Args) => {
      const gte = (where?.["quantity"] as { gte?: Decimal.Value } | undefined)?.gte;
      const rows = this.balances.filter(
        (b) => b.warehouseId === where?.["warehouseId"] && b.materialId === where?.["materialId"] && (gte === undefined || b.quantity.gte(gte))
      );
      rows.forEach((b) => { b.quantity = applyNumberOp(b.quantity, data?.["quantity"]); });
      return { count: rows.length };
    },
    upsert: async ({ where, data, ...rest }: Args & { create?: Where; update?: Where }) => {
      const key = where?.["warehouseId_materialId"] as { warehouseId: string; materialId: string };
      const existing = this.balances.find((b) => b.warehouseId === key.warehouseId && b.materialId === key.materialId);
      if (existing) existing.quantity = applyNumberOp(existing.quantity, (rest.update?.["quantity"]));
      else this.balances.push({ warehouseId: key.warehouseId, materialId: key.materialId, quantity: dec(rest.create?.["quantity"]) });
      void data;
      return {};
    },
  };

  stockLot = {
    findMany: async ({ where }: Args) => {
      const w = where ?? {};
      const ids = (w["id"] as { in?: string[] } | undefined)?.in;
      const or = w["OR"] as Array<{ projectId: string | null }> | undefined;
      const lte = (w["purchaseInvoiceDate"] as { lte?: Date } | undefined)?.lte;
      return this.lots
        .filter((l) => (!ids || ids.includes(l.id)))
        .filter((l) => !w["warehouseId"] || l.warehouseId === w["warehouseId"])
        .filter((l) => !w["materialId"] || l.materialId === w["materialId"])
        .filter((l) => !w["remainingQuantity"] || l.remainingQuantity.gt(0))
        .filter((l) => !lte || l.purchaseInvoiceDate.getTime() <= lte.getTime())
        .filter((l) => !("projectId" in w) || l.projectId === w["projectId"])
        .filter((l) => !or || or.some((c) => c.projectId === l.projectId))
        .sort((a, b) => a.purchaseInvoiceDate.getTime() - b.purchaseInvoiceDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
    },
    updateMany: async ({ where, data }: Args) => {
      const gte = (where?.["remainingQuantity"] as { gte?: Decimal.Value } | undefined)?.gte;
      const lot = this.lots.find((l) => l.id === where?.["id"]);
      if (!lot || (gte !== undefined && lot.remainingQuantity.lt(gte))) return { count: 0 };
      lot.remainingQuantity = applyNumberOp(lot.remainingQuantity, data?.["remainingQuantity"]);
      return { count: 1 };
    },
  };

  private issueWithItems(issue: FakeIssue) {
    return {
      ...issue,
      items: this.items
        .filter((i) => i.issueId === issue.id)
        .map((i) => ({ ...i, lotConsumptions: this.consumptions.filter((c) => c.issueItemId === i.id) })),
    };
  }

  stockIssue = {
    create: async ({ data }: Args) => {
      const { items, ...rest } = data as Where & { items: { create: Array<{ materialId: string; quantity: Decimal; unitPrice: Decimal; total: Decimal }> } };
      const id = this.nextId("issue");
      this.addIssue({ ...(rest as Partial<FakeIssue>), id, items: [] });
      items.create.forEach((line) => this.items.push({ id: this.nextId("item"), issueId: id, ...line }));
      return { id, issueNo: rest["issueNo"] as string };
    },
    findFirst: async ({ where }: Args) => {
      if (where?.["issueNo"]) return null; // numbering lookup: start from 001
      const issue = this.issues.find(
        (i) => i.id === where?.["id"] && (!where?.["status"] || i.status === where["status"]) && i.deletedAt === null
      );
      return issue ? this.issueWithItems(issue) : null;
    },
    updateMany: async ({ where, data }: Args) => {
      const issue = this.issues.find((i) => i.id === where?.["id"] && (!where?.["status"] || i.status === where["status"]));
      if (!issue) return { count: 0 };
      Object.assign(issue, data);
      return { count: 1 };
    },
    update: async ({ where, data }: Args) => {
      const issue = this.issues.find((i) => i.id === where?.["id"])!;
      Object.assign(issue, data);
      return issue;
    },
  };

  stockIssueItem = {
    update: async ({ where, data }: Args) => {
      const item = this.items.find((i) => i.id === where?.["id"])!;
      item.unitPrice = dec(data?.["unitPrice"]);
      item.total = dec(data?.["total"]);
      const create = ((data?.["lotConsumptions"] as { create?: Array<Omit<FakeConsumption, "id" | "issueItemId">> } | undefined)?.create) ?? [];
      create.forEach((c) => this.consumptions.push({ id: this.nextId("cons"), issueItemId: item.id, ...c }));
      return item;
    },
  };

  project = {
    findUnique: async ({ where }: Args) => this.projects.get(where?.["id"] as string) ?? null,
  };
  projectMaterialAllocation = {
    findUnique: async ({ where }: Args) => this.allocations.get(where?.["id"] as string) ?? null,
  };

  stockReceipt = {
    findFirst: async ({ where }: Args) => {
      if (where?.["returnedFromIssueId"]) {
        return this.receipts.find((r) => r.returnedFromIssueId === where["returnedFromIssueId"]) ?? null;
      }
      return null;
    },
    create: async ({ data }: Args) => {
      const items = ((data?.["items"] as { create: FakeReceipt["items"] }).create) ?? [];
      const receipt: FakeReceipt = {
        id: this.nextId("rcpt"), receiptNo: data?.["receiptNo"] as string, warehouseId: data?.["warehouseId"] as string,
        status: data?.["status"] as string, receiptType: data?.["receiptType"] as string,
        returnedFromIssueId: (data?.["returnedFromIssueId"] as string) ?? null, totalAmount: dec(data?.["totalAmount"]),
        notes: (data?.["notes"] as string) ?? null, items: items.map((i) => ({ ...i, quantity: dec(i.quantity), unitPrice: dec(i.unitPrice), total: dec(i.total) })),
      };
      this.receipts.push(receipt);
      return receipt;
    },
  };
}
