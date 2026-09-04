import type { Prisma } from "@prisma/client";
import { DecimalLike, decimalToNumber, toDecimal } from "../common/utils/decimal";

export function mapBusinessDocumentSummary(document: {
  id: string;
  type: string;
  source: string;
  status: string;
  title: string;
  documentNo: string | null;
  documentDate: Date | null;
  fileUrl: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string };
}) {
  return {
    id: document.id,
    type: document.type,
    source: document.source,
    status: document.status,
    title: document.title,
    documentNo: document.documentNo,
    documentDate: document.documentDate,
    fileUrl: document.fileUrl,
    createdAt: document.createdAt,
    createdBy: document.createdBy
  };
}

export function mapBusinessDocument(document: {
  id: string;
  type: string;
  source: string;
  status: string;
  title: string;
  documentNo: string | null;
  documentDate: Date | null;
  fileUrl: string | null;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  notes: string | null;
  customerId: string | null;
  projectId: string | null;
  quoteId: string | null;
  contractId: string | null;
  paymentId: string | null;
  generatedDocumentId: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; shortName: string | null } | null;
  project: { id: string; code: string; name: string } | null;
  quote: { id: string; quoteNo: string; version: number } | null;
  contract: { id: string; contractNo: string } | null;
  payment: { id: string; amount: Prisma.Decimal; paidAt: Date } | null;
  generatedDocument: { id: string; number: string; pdfPath: string | null } | null;
  parent: { id: string; title: string; status: string } | null;
  createdBy: { id: string; name: string };
}) {
  return {
    id: document.id,
    type: document.type,
    source: document.source,
    status: document.status,
    title: document.title,
    documentNo: document.documentNo,
    documentDate: document.documentDate,
    fileUrl: document.fileUrl,
    filename: document.filename,
    mimeType: document.mimeType,
    size: document.size,
    notes: document.notes,
    customerId: document.customerId,
    projectId: document.projectId,
    quoteId: document.quoteId,
    contractId: document.contractId,
    paymentId: document.paymentId,
    generatedDocumentId: document.generatedDocumentId,
    parentId: document.parentId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    customer: document.customer,
    project: document.project,
    quote: document.quote,
    contract: document.contract,
    payment: document.payment
      ? {
          ...document.payment,
          amount: Number(document.payment.amount)
        }
      : null,
    generatedDocument: document.generatedDocument,
    parent: document.parent,
    createdBy: document.createdBy
  };
}

export function mapHandover(handover: {
  id: string;
  projectId: string;
  summary: string | null;
  customerRequirements: string | null;
  risks: string | null;
  decisions: string | null;
  openTasks: string | null;
  importantDocumentIds: string[];
  fromUserId: string | null;
  toUserId: string | null;
  createdById: string;
  createdAt: Date;
  fromUser: { id: string; name: string } | null;
  toUser: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
}) {
  return {
    id: handover.id,
    projectId: handover.projectId,
    summary: handover.summary,
    customerRequirements: handover.customerRequirements,
    risks: handover.risks,
    decisions: handover.decisions,
    openTasks: handover.openTasks,
    importantDocumentIds: handover.importantDocumentIds,
    fromUserId: handover.fromUserId,
    toUserId: handover.toUserId,
    createdById: handover.createdById,
    createdAt: handover.createdAt,
    fromUser: handover.fromUser,
    toUser: handover.toUser,
    createdBy: handover.createdBy
  };
}

export function materialAllocationInclude() {
  return {
    items: {
      include: {
        stockLot: {
          include: {
            stockReceiptItem: {
              select: {
                receipt: {
                  select: {
                    id: true,
                    receiptNo: true,
                    date: true,
                    purchaseInvoiceNo: true
                  }
                }
              }
            }
          }
        },
        warehouse: { select: { id: true, code: true, name: true } },
        material: { select: { id: true, code: true, name: true, unit: true } }
      },
      orderBy: { id: "asc" as const }
    },
    stockIssues: {
      select: {
        id: true,
        issueNo: true,
        warehouseId: true,
        date: true,
        status: true,
        totalAmount: true
      },
      orderBy: { createdAt: "asc" as const }
    }
  } as const;
}

export function mapStockLot(lot: {
  id: string;
  warehouseId: string;
  warehouse: { id: string; code: string; name: string };
  materialId: string;
  material: { id: string; code: string; name: string; unit: string };
  purchaseInvoiceDate: Date;
  purchaseInvoiceNo: string | null;
  receivedQuantity: DecimalLike;
  remainingQuantity: DecimalLike;
  unitPrice: DecimalLike;
  stockReceiptItem: {
    receipt: {
      id: string;
      receiptNo: string;
      date: Date;
      purchaseInvoiceNo: string | null;
    };
  } | null;
}) {
  const receipt = lot.stockReceiptItem?.receipt ?? null;
  return {
    id: lot.id,
    warehouseId: lot.warehouseId,
    warehouse: lot.warehouse,
    materialId: lot.materialId,
    material: lot.material,
    receipt,
    purchaseInvoiceDate: lot.purchaseInvoiceDate,
    purchaseInvoiceNo: lot.purchaseInvoiceNo ?? receipt?.purchaseInvoiceNo ?? null,
    receivedQuantity: decimalToNumber(lot.receivedQuantity),
    remainingQuantity: decimalToNumber(lot.remainingQuantity),
    unitPrice: decimalToNumber(lot.unitPrice),
    value: decimalToNumber(toDecimal(lot.remainingQuantity).mul(toDecimal(lot.unitPrice)).toDecimalPlaces(0))
  };
}

export function mapMaterialAllocation(allocation: {
  id: string;
  projectId: string;
  salesInvoiceDate: Date;
  status: string;
  notes: string | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    stockLotId: string;
    warehouseId: string;
    warehouse: { id: string; code: string; name: string };
    materialId: string;
    material: { id: string; code: string; name: string; unit: string };
    quantity: DecimalLike;
    unitPrice: DecimalLike;
    total: DecimalLike;
    stockLot: {
      purchaseInvoiceDate: Date;
      purchaseInvoiceNo: string | null;
      remainingQuantity: DecimalLike;
      stockReceiptItem: {
        receipt: {
          id: string;
          receiptNo: string;
          date: Date;
          purchaseInvoiceNo: string | null;
        };
      } | null;
    };
  }>;
  stockIssues: Array<{
    id: string;
    issueNo: string;
    warehouseId: string;
    date: Date;
    status: string;
    totalAmount: DecimalLike;
  }>;
}) {
  return {
    id: allocation.id,
    projectId: allocation.projectId,
    salesInvoiceDate: allocation.salesInvoiceDate,
    status: allocation.status,
    notes: allocation.notes,
    confirmedAt: allocation.confirmedAt,
    cancelledAt: allocation.cancelledAt,
    createdAt: allocation.createdAt,
    updatedAt: allocation.updatedAt,
    totalAmount: allocation.items.reduce((sum, item) => sum + decimalToNumber(item.total), 0),
    items: allocation.items.map((item) => ({
      id: item.id,
      stockLotId: item.stockLotId,
      warehouseId: item.warehouseId,
      warehouse: item.warehouse,
      materialId: item.materialId,
      material: item.material,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      total: decimalToNumber(item.total),
      purchaseInvoiceDate: item.stockLot.purchaseInvoiceDate,
      purchaseInvoiceNo: item.stockLot.purchaseInvoiceNo ?? item.stockLot.stockReceiptItem?.receipt.purchaseInvoiceNo ?? null,
      receipt: item.stockLot.stockReceiptItem?.receipt ?? null,
      remainingQuantity: decimalToNumber(item.stockLot.remainingQuantity)
    })),
    stockIssues: allocation.stockIssues.map((issue) => ({
      ...issue,
      totalAmount: decimalToNumber(issue.totalAmount)
    }))
  };
}
