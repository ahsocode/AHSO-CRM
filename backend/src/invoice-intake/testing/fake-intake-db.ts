/**
 * Minimal in-memory stand-in for the Prisma client used by invoice-intake specs.
 * Test-only helper (no jest dependency). It enforces the partial unique index on
 * active receipts so concurrent-submission behaviour can be exercised.
 */
import { Decimal } from "@prisma/client/runtime/library";

export type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

function matchValue(actual: unknown, cond: unknown): boolean {
  if (cond && typeof cond === "object" && !(cond instanceof Date) && !(cond instanceof Decimal)) {
    const c = cond as Record<string, unknown>;
    if ("not" in c) return actual !== c.not;
    if ("startsWith" in c) return typeof actual === "string" && actual.startsWith(String(c.startsWith));
    if ("contains" in c) return typeof actual === "string" && actual.includes(String(c.contains));
    if ("in" in c) return (c.in as unknown[]).includes(actual);
    if ("gt" in c) return Number(actual) > Number(c.gt);
    return false;
  }
  if (cond === null) return actual === null || actual === undefined;
  return actual === cond;
}

export function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));
    if (key === "AND") return (cond as Where[]).every((w) => matches(row, w));
    return matchValue(row[key], cond);
  });
}

export class FakeIntakeDb {
  private seq = 0;
  readonly tables: Record<string, Row[]> = {
    supplier: [], material: [], materialSupplier: [], materialAlias: [], warehouse: [], project: [],
    stockReceipt: [], receiptPendingLine: [], stockReceiptItem: [], projectCost: []
  };
  readonly settings = new Map<string, string>();
  readonly calls = { transaction: 0, receiptCreate: 0, costCreate: 0 };
  /** When > 0, the next N receipt lookups by invoice key return nothing (simulates a lost race). */
  blindLookups = 0;

  nextId(prefix: string) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  seed(table: string, row: Record<string, unknown>): Row {
    const full = { id: this.nextId(table), deletedAt: null, ...row } as Row;
    this.tables[table].push(full);
    return full;
  }

  private find(table: string, where?: Where) {
    return this.tables[table].filter((r) => matches(r, where));
  }

  private delegate(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const t = this;
    return {
      findFirst: async (args?: { where?: Where; include?: unknown }) => t.withRelations(table, t.find(table, args?.where)[0] ?? null),
      findMany: async (args?: { where?: Where; take?: number }) => {
        const rows = t.find(table, args?.where).map((r) => t.withRelations(table, r));
        return args?.take ? rows.slice(0, args.take) : rows;
      },
      findUnique: async (args: { where: Where }) => t.withRelations(table, t.find(table, args.where)[0] ?? null),
      count: async (args?: { where?: Where }) => t.find(table, args?.where).length,
      updateMany: async (args: { where?: Where; data: Row }) => {
        const rows = t.find(table, args.where);
        rows.forEach((r) => Object.assign(r, t.applyData(r, args.data)));
        return { count: rows.length };
      },
      update: async (args: { where: Where; data: Row }) => {
        const row = t.find(table, args.where)[0];
        if (!row) throw new Error(`${table} not found`);
        Object.assign(row, t.applyData(row, args.data));
        return row;
      }
    };
  }

  private applyData(row: Row, data: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in (v as object)) {
        out[k] = new Decimal(String(row[k] ?? 0)).plus(String((v as { increment: Decimal.Value }).increment));
      } else out[k] = v;
    }
    return out;
  }

  private withRelations(table: string, row: Row | null) {
    if (!row) return null;
    if (table === "stockReceipt") {
      return { ...row, items: this.tables.stockReceiptItem.filter((i) => i.receiptId === row.id) };
    }
    return row;
  }

  private uniqueGuard(data: Where) {
    if (!data.sellerTaxCode || !data.invoiceSeries || !data.invoiceNumber) return;
    const clash = this.tables.stockReceipt.find(
      (r) =>
        r.sellerTaxCode === data.sellerTaxCode && r.invoiceSeries === data.invoiceSeries &&
        r.invoiceNumber === data.invoiceNumber && r.status !== "CANCELLED" && !r.deletedAt
    );
    if (clash) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: "StockReceipt_invoice_active_key" } });
  }

  readonly client = (() => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const t = this;
    const make = (table: string) => t.delegate(table);
    const receipt = {
      ...make("stockReceipt"),
      findFirst: async (args?: { where?: Where }) => {
        const w = args?.where;
        if (t.blindLookups > 0 && w && "invoiceNumber" in w && "sellerTaxCode" in w) {
          t.blindLookups -= 1;
          return null;
        }
        return t.withRelations("stockReceipt", t.find("stockReceipt", w)[0] ?? null);
      },
      findMany: async (args?: { where?: Where }) =>
        t.find("stockReceipt", args?.where).map((r) => t.withRelations("stockReceipt", r)),
      create: async (args: { data: Where & { items?: { create: Where[] }; pendingLines?: { create: Where[] } } }) => {
        t.calls.receiptCreate += 1;
        const { items, pendingLines, ...data } = args.data;
        t.uniqueGuard(data);
        const row = t.seed("stockReceipt", { status: "DRAFT", ...data });
        for (const item of items?.create ?? []) t.seed("stockReceiptItem", { ...item, receiptId: row.id });
        for (const line of pendingLines?.create ?? []) t.seed("receiptPendingLine", { status: "PENDING", ...line, receiptId: row.id });
        return row;
      }
    };
    return {
      $executeRaw: async () => 0,
      $transaction: async (arg: unknown) => {
        t.calls.transaction += 1;
        if (Array.isArray(arg)) return Promise.all(arg);
        return (arg as (tx: unknown) => Promise<unknown>)(t.client);
      },
      setting: { findUnique: async (a: { where: { key: string } }) => (t.settings.has(a.where.key) ? { key: a.where.key, value: t.settings.get(a.where.key) } : null) },
      supplier: make("supplier"),
      material: make("material"),
      materialSupplier: make("materialSupplier"),
      materialAlias: {
        ...make("materialAlias"),
        create: async (args: { data: Where }) => t.seed("materialAlias", { createdAt: new Date(), ...args.data }),
        findMany: async (args?: { where?: Where; take?: number }) => t.find("materialAlias", args?.where).slice(0, args?.take ?? 1000)
      },
      warehouse: make("warehouse"),
      project: make("project"),
      stockReceipt: receipt,
      stockReceiptItem: {
        ...make("stockReceiptItem"),
        create: async (args: { data: Where }) => t.seed("stockReceiptItem", args.data)
      },
      receiptPendingLine: {
        ...make("receiptPendingLine"),
        findUnique: async (args: { where: Where }) => {
          const line = t.find("receiptPendingLine", args.where)[0];
          return line ? { ...line, receipt: t.tables.stockReceipt.find((r) => r.id === line.receiptId) } : null;
        }
      },
      projectCost: {
        ...make("projectCost"),
        create: async (args: { data: Where }) => {
          t.calls.costCreate += 1;
          return t.seed("projectCost", args.data);
        }
      }
    };
  })();
}
