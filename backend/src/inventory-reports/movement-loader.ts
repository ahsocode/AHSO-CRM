import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { PrismaService } from "../common/prisma.service";
import type { MovementEvent } from "./movement-replay";

/** Invoice facts of the purchase receipt a quantity came from. */
export interface InvoiceRef {
  receiptId: string | null;
  receiptNo: string | null;
  supplierId: string | null;
  supplierName: string | null;
  sellerTaxCode: string | null;
  invoiceSeries: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
}

export interface LotSource extends InvoiceRef {
  sourceReceiptLotId: string;
  quantity: Decimal;
  lotUnitPrice: Decimal;
  lotPurchaseInvoiceDate: Date;
  invoiceDateWarning: boolean;
}

export type DocumentType = "STOCK_RECEIPT" | "STOCK_ISSUE" | "STOCK_TRANSFER" | "STOCK_COUNT";

export interface LedgerMeta {
  documentType: DocumentType;
  documentId: string;
  documentNo: string;
  lineId: string;
  documentDate: Date;
  counterpartyWarehouseId: string | null;
  projectId: string | null;
  subType: string | null;
  invoice: InvoiceRef | null;
  sources: LotSource[];
  reversal: boolean;
}

export interface LoadOptions {
  /** Restrict to these materials (the average cost is per material, so never filter by warehouse here). */
  materialIds?: string[];
  /** Business-date cut-off (inclusive). Omit to load everything. */
  toDate?: Date;
  /** Load invoice / lot source details (ledger). False = lean rows for valuation. */
  detail: boolean;
}

interface ReceiptRefRow {
  id: string;
  receiptNo: string;
  invoiceSeries: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  sellerTaxCode: string | null;
  supplier: { id: string; name: string; taxCode: string | null } | null;
}

export function invoiceRefFromReceipt(receipt: ReceiptRefRow | null | undefined): InvoiceRef | null {
  if (!receipt) return null;
  return {
    receiptId: receipt.id,
    receiptNo: receipt.receiptNo,
    supplierId: receipt.supplier?.id ?? null,
    supplierName: receipt.supplier?.name ?? null,
    sellerTaxCode: receipt.sellerTaxCode ?? receipt.supplier?.taxCode ?? null,
    invoiceSeries: receipt.invoiceSeries,
    invoiceNumber: receipt.invoiceNumber,
    invoiceDate: receipt.invoiceDate
  };
}

const RECEIPT_REF_SELECT = {
  id: true,
  receiptNo: true,
  invoiceSeries: true,
  invoiceNumber: true,
  invoiceDate: true,
  sellerTaxCode: true,
  supplier: { select: { id: true, name: true, taxCode: true } }
} as const;

const receiptItemSelect = {
  id: true,
  materialId: true,
  quantity: true,
  unitPrice: true,
  total: true,
  projectId: true,
  valueAdjustment: true,
  receipt: {
    select: {
      ...RECEIPT_REF_SELECT,
      warehouseId: true,
      date: true,
      confirmedAt: true,
      receiptType: true,
      returnedFromIssue: { select: { status: true } }
    }
  }
} satisfies Prisma.StockReceiptItemSelect;

const issueItemLeanSelect = {
  id: true,
  materialId: true,
  quantity: true,
  unitPrice: true,
  total: true,
  issue: {
    select: { id: true, issueNo: true, warehouseId: true, date: true, confirmedAt: true, cancelledAt: true, status: true, projectId: true, reasonType: true }
  }
} satisfies Prisma.StockIssueItemSelect;

const issueItemDetailSelect = {
  ...issueItemLeanSelect,
  lotConsumptions: {
    select: {
      stockLotId: true,
      quantity: true,
      lotUnitPrice: true,
      invoiceDateWarning: true,
      stockLot: {
        select: {
          purchaseInvoiceDate: true,
          stockReceiptItem: { select: { receipt: { select: RECEIPT_REF_SELECT } } }
        }
      }
    }
  }
} satisfies Prisma.StockIssueItemSelect;

type IssueItemRow = Prisma.StockIssueItemGetPayload<{ select: typeof issueItemLeanSelect }> & {
  lotConsumptions?: Prisma.StockIssueItemGetPayload<{ select: typeof issueItemDetailSelect }>["lotConsumptions"];
};

function lotSources(row: IssueItemRow): LotSource[] {
  return (row.lotConsumptions ?? []).map((c) => {
    const ref = invoiceRefFromReceipt(c.stockLot.stockReceiptItem?.receipt);
    return {
      receiptId: ref?.receiptId ?? null,
      receiptNo: ref?.receiptNo ?? null,
      supplierId: ref?.supplierId ?? null,
      supplierName: ref?.supplierName ?? null,
      sellerTaxCode: ref?.sellerTaxCode ?? null,
      invoiceSeries: ref?.invoiceSeries ?? null,
      invoiceNumber: ref?.invoiceNumber ?? null,
      invoiceDate: ref?.invoiceDate ?? null,
      sourceReceiptLotId: c.stockLotId,
      quantity: new Decimal(c.quantity),
      lotUnitPrice: new Decimal(c.lotUnitPrice),
      lotPurchaseInvoiceDate: c.stockLot.purchaseInvoiceDate,
      invoiceDateWarning: c.invoiceDateWarning
    };
  });
}

/**
 * Loads confirmed receipts, confirmed + cancelled issues (cancelled = original line + reversal at cancelledAt),
 * confirmed transfers and confirmed counts as ordered-agnostic movement events. Read-only.
 * Queries hit the materialId index (item side) and the status/deletedAt index (document side).
 */
export async function loadMovementEvents(
  prisma: PrismaService,
  options: LoadOptions
): Promise<MovementEvent<LedgerMeta>[]> {
  const { materialIds, toDate, detail } = options;
  const materialFilter = materialIds ? { in: materialIds } : undefined;
  const dateFilter = toDate ? { lte: toDate } : undefined;
  const events: MovementEvent<LedgerMeta>[] = [];

  const [receiptItems, issueItems, transferItems, countItems] = await Promise.all([
    prisma.stockReceiptItem.findMany({
      where: {
        ...(materialFilter ? { materialId: materialFilter } : {}),
        receipt: { status: "CONFIRMED", deletedAt: null, ...(dateFilter ? { date: dateFilter } : {}) }
      },
      select: receiptItemSelect
    }),
    prisma.stockIssueItem.findMany({
      where: {
        ...(materialFilter ? { materialId: materialFilter } : {}),
        issue: {
          deletedAt: null,
          ...(dateFilter ? { date: dateFilter } : {}),
          OR: [{ status: "CONFIRMED" }, { status: "CANCELLED", confirmedAt: { not: null } }]
        }
      },
      select: detail ? issueItemDetailSelect : issueItemLeanSelect
    }) as Promise<IssueItemRow[]>,
    prisma.stockTransferItem.findMany({
      where: {
        ...(materialFilter ? { materialId: materialFilter } : {}),
        transfer: { status: "CONFIRMED", deletedAt: null, ...(dateFilter ? { date: dateFilter } : {}) }
      },
      select: {
        id: true,
        materialId: true,
        quantity: true,
        transfer: { select: { id: true, transferNo: true, fromWarehouseId: true, toWarehouseId: true, date: true, confirmedAt: true } }
      }
    }),
    prisma.stockCountItem.findMany({
      where: {
        ...(materialFilter ? { materialId: materialFilter } : {}),
        diff: { not: 0 },
        count: { status: "CONFIRMED", deletedAt: null, ...(dateFilter ? { date: dateFilter } : {}) }
      },
      select: {
        id: true,
        materialId: true,
        diff: true,
        count: { select: { id: true, countNo: true, warehouseId: true, date: true, confirmedAt: true } }
      }
    })
  ]);

  for (const item of receiptItems) {
    const r = item.receipt;
    // Cancelling a confirmed issue also books an auto RETURN_FROM_PROJECT receipt; the ledger already
    // shows that as the ISSUE_REVERSAL line of the cancelled issue, so skip the receipt to avoid counting twice.
    if (r.receiptType === "RETURN_FROM_PROJECT" && r.returnedFromIssue?.status === "CANCELLED") continue;
    const isAdjustment = r.receiptType === "ADJUSTMENT";
    events.push({
      id: `R:${item.id}`,
      kind: isAdjustment ? "RECEIPT_ADJUSTMENT" : "RECEIPT",
      materialId: item.materialId,
      warehouseId: r.warehouseId,
      eventDate: r.date,
      sortAt: r.confirmedAt ?? r.date,
      quantity: new Decimal(item.quantity),
      unitPrice: new Decimal(item.unitPrice),
      recordedValue: new Decimal(item.total),
      valueAdjustment: item.valueAdjustment ? new Decimal(item.valueAdjustment) : null,
      meta: {
        documentType: "STOCK_RECEIPT",
        documentId: r.id,
        documentNo: r.receiptNo,
        lineId: item.id,
        documentDate: r.date,
        counterpartyWarehouseId: null,
        projectId: item.projectId,
        subType: r.receiptType,
        invoice: invoiceRefFromReceipt(r),
        sources: [],
        reversal: false
      }
    });
  }

  for (const item of issueItems) {
    const i = item.issue;
    const qtyOut = new Decimal(item.quantity);
    const sources = lotSources(item);
    const base = {
      materialId: item.materialId,
      warehouseId: i.warehouseId,
      unitPrice: new Decimal(item.unitPrice),
      recordedValue: new Decimal(item.total),
      valueAdjustment: null
    };
    const meta = (reversal: boolean): LedgerMeta => ({
      documentType: "STOCK_ISSUE",
      documentId: i.id,
      documentNo: i.issueNo,
      lineId: item.id,
      documentDate: i.date,
      counterpartyWarehouseId: null,
      projectId: i.projectId,
      subType: i.reasonType,
      invoice: sources.length === 1 ? invoiceRefFromReceiptFromSource(sources[0]) : null,
      sources,
      reversal
    });
    events.push({
      ...base,
      id: `I:${item.id}`,
      kind: "ISSUE",
      eventDate: i.date,
      sortAt: i.confirmedAt ?? i.date,
      quantity: qtyOut.negated(),
      meta: meta(false)
    });
    if (i.status === "CANCELLED" && i.cancelledAt && (!toDate || i.cancelledAt.getTime() <= toDate.getTime())) {
      events.push({
        ...base,
        id: `IR:${item.id}`,
        kind: "ISSUE_REVERSAL",
        eventDate: i.cancelledAt,
        sortAt: i.cancelledAt,
        quantity: qtyOut,
        meta: meta(true)
      });
    }
  }

  for (const item of transferItems) {
    const t = item.transfer;
    const q = new Decimal(item.quantity);
    const common = { materialId: item.materialId, unitPrice: null, recordedValue: null, valueAdjustment: null, eventDate: t.date, sortAt: t.confirmedAt ?? t.date };
    const meta = (counterparty: string): LedgerMeta => ({
      documentType: "STOCK_TRANSFER",
      documentId: t.id,
      documentNo: t.transferNo,
      lineId: item.id,
      documentDate: t.date,
      counterpartyWarehouseId: counterparty,
      projectId: null,
      subType: null,
      invoice: null,
      sources: [],
      reversal: false
    });
    events.push({ ...common, id: `T:${item.id}:out`, kind: "TRANSFER_OUT", warehouseId: t.fromWarehouseId, quantity: q.negated(), meta: meta(t.toWarehouseId) });
    events.push({ ...common, id: `T:${item.id}:in`, kind: "TRANSFER_IN", warehouseId: t.toWarehouseId, quantity: q, meta: meta(t.fromWarehouseId) });
  }

  for (const item of countItems) {
    const c = item.count;
    events.push({
      id: `C:${item.id}`,
      kind: "COUNT_ADJUSTMENT",
      materialId: item.materialId,
      warehouseId: c.warehouseId,
      eventDate: c.date,
      sortAt: c.confirmedAt ?? c.date,
      quantity: new Decimal(item.diff),
      unitPrice: null,
      recordedValue: null,
      valueAdjustment: null,
      meta: {
        documentType: "STOCK_COUNT",
        documentId: c.id,
        documentNo: c.countNo,
        lineId: item.id,
        documentDate: c.date,
        counterpartyWarehouseId: null,
        projectId: null,
        subType: null,
        invoice: null,
        sources: [],
        reversal: false
      }
    });
  }

  return events;
}

function invoiceRefFromReceiptFromSource(source: LotSource): InvoiceRef {
  return {
    receiptId: source.receiptId,
    receiptNo: source.receiptNo,
    supplierId: source.supplierId,
    supplierName: source.supplierName,
    sellerTaxCode: source.sellerTaxCode,
    invoiceSeries: source.invoiceSeries,
    invoiceNumber: source.invoiceNumber,
    invoiceDate: source.invoiceDate
  };
}
