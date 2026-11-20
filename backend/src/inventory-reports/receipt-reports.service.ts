import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { canViewCost } from "../inventory/inventory-controls";
import type {
  InvoiceDateWarningsQuery,
  ReceiptsWithoutInvoiceQuery,
  UnallocatedReceiptsQuery
} from "./inventory-reports.dto";
import {
  buildPage,
  endOfDayUtc,
  isoDate,
  maskReport,
  money,
  qty,
  startOfDayUtc,
  type ReportEnvelope
} from "./report-contract";
import { buildReportMeta } from "./report-meta";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateRange(fromDate?: Date, toDate?: Date): Prisma.DateTimeFilter | undefined {
  if (!fromDate && !toDate) return undefined;
  return { ...(fromDate ? { gte: startOfDayUtc(fromDate) } : {}), ...(toDate ? { lte: endOfDayUtc(toDate) } : {}) };
}

@Injectable()
export class ReceiptReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confirmed purchase-receipt lines that carry no project and still have stock in their lots,
   * excluding CONSUMABLE_COMMON materials (allocated at period end) unless includeCommon=true.
   * These are the lines somebody still has to allocate to a project or confirm as general stock.
   */
  async unallocatedReceipts(query: UnallocatedReceiptsQuery, user: JwtUser): Promise<ReportEnvelope<Record<string, unknown>>> {
    const costVisible = canViewCost(user);
    const range = dateRange(query.fromDate, query.toDate);
    const where: Prisma.StockReceiptItemWhereInput = {
      projectId: null,
      ...(query.materialId ? { materialId: query.materialId } : {}),
      ...(query.includeCommon
        ? {}
        : { material: { OR: [{ accountingClass: null }, { accountingClass: { not: "CONSUMABLE_COMMON" } }] } }),
      stockLots: { some: { remainingQuantity: { gt: 0 }, projectId: null } },
      receipt: {
        status: "CONFIRMED",
        deletedAt: null,
        receiptType: "PURCHASE",
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(range ? { date: range } : {})
      }
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.stockReceiptItem.count({ where }),
      this.prisma.stockReceiptItem.findMany({
        where,
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          total: true,
          material: { select: { id: true, code: true, name: true, unit: true, accountingClass: true } },
          stockLots: { select: { id: true, remainingQuantity: true, unitPrice: true } },
          receipt: {
            select: {
              id: true, receiptNo: true, date: true, warehouseId: true, invoiceSeries: true, invoiceNumber: true,
              invoiceDate: true, sellerTaxCode: true,
              supplier: { select: { id: true, name: true, taxCode: true } },
              warehouse: { select: { code: true, name: true } }
            }
          }
        },
        orderBy: [{ receipt: { date: "asc" } }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      })
    ]);

    const now = Date.now();
    const data = items.map((item) => {
      const remaining = item.stockLots.reduce((sum, lot) => sum.plus(lot.remainingQuantity), new Decimal(0));
      const remainingValue = item.stockLots.reduce((sum, lot) => sum.plus(new Decimal(lot.remainingQuantity).mul(lot.unitPrice)), new Decimal(0));
      const r = item.receipt;
      return {
        receiptId: r.id,
        receiptNo: r.receiptNo,
        receiptDate: isoDate(r.date),
        lineId: item.id,
        warehouseId: r.warehouseId,
        warehouseCode: r.warehouse.code,
        supplierId: r.supplier?.id ?? null,
        supplier: r.supplier?.name ?? null,
        sellerTaxCode: r.sellerTaxCode ?? r.supplier?.taxCode ?? null,
        invoiceSeries: r.invoiceSeries,
        invoiceNumber: r.invoiceNumber,
        invoiceDate: isoDate(r.invoiceDate),
        materialId: item.material.id,
        materialCode: item.material.code,
        materialName: item.material.name,
        unit: item.material.unit,
        accountingClass: item.material.accountingClass,
        quantity: qty(item.quantity),
        unitPrice: money(item.unitPrice),
        amount: money(item.total),
        remainingQuantity: qty(remaining),
        remainingValue: money(remainingValue),
        lotIds: item.stockLots.map((lot) => lot.id),
        ageDays: Math.max(0, Math.floor((now - r.date.getTime()) / DAY_MS))
      };
    });

    const masked = maskReport(data, costVisible);
    const meta = await buildReportMeta(this.prisma, user, {
      referenceDate: query.toDate ?? new Date(),
      period: { from: query.fromDate ?? null, to: query.toDate ?? null },
      filters: { fromDate: query.fromDate, toDate: query.toDate, warehouseId: query.warehouseId, supplierId: query.supplierId, materialId: query.materialId, includeCommon: query.includeCommon ?? false },
      extra: {
        definition:
          "Dòng phiếu nhập PURCHASE đã xác nhận, không gắn dự án, lô còn tồn; mặc định loại vật tư CONSUMABLE_COMMON (phân bổ cuối kỳ)."
      }
    });
    return { meta, data: masked, page: buildPage(query.page, query.limit, total) };
  }

  /**
   * Confirmed purchase receipts missing invoice data. Migration gate for the legacy receipts:
   * mode NUMBER (default) = no invoiceNumber; ANY_FIELD = also missing series, date or seller tax code
   * (the supplier tax code counts as seller tax code).
   */
  async receiptsWithoutInvoice(query: ReceiptsWithoutInvoiceQuery, user: JwtUser): Promise<ReportEnvelope<Record<string, unknown>>> {
    const costVisible = canViewCost(user);
    const range = dateRange(query.fromDate, query.toDate);
    const missingNumber: Prisma.StockReceiptWhereInput[] = [{ invoiceNumber: null }, { invoiceNumber: "" }];
    const missing: Prisma.StockReceiptWhereInput[] =
      query.mode === "ANY_FIELD"
        ? [
            ...missingNumber,
            { invoiceSeries: null },
            { invoiceSeries: "" },
            { invoiceDate: null },
            { AND: [{ OR: [{ sellerTaxCode: null }, { sellerTaxCode: "" }] }, { OR: [{ supplierId: null }, { supplier: { OR: [{ taxCode: null }, { taxCode: "" }] } }] }] }
          ]
        : missingNumber;

    const where: Prisma.StockReceiptWhereInput = {
      status: "CONFIRMED",
      deletedAt: null,
      receiptType: "PURCHASE",
      OR: missing,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(range ? { date: range } : {})
    };

    const [total, receipts] = await this.prisma.$transaction([
      this.prisma.stockReceipt.count({ where }),
      this.prisma.stockReceipt.findMany({
        where,
        select: {
          id: true, receiptNo: true, date: true, warehouseId: true, totalAmount: true, purchaseInvoiceNo: true, confirmedAt: true,
          invoiceSeries: true, invoiceNumber: true, invoiceDate: true, sellerTaxCode: true,
          supplier: { select: { id: true, name: true, taxCode: true } },
          warehouse: { select: { code: true, name: true } },
          _count: { select: { items: true } }
        },
        orderBy: [{ date: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      })
    ]);

    const data = receipts.map((r) => {
      const missingFields: string[] = [];
      if (!r.invoiceNumber) missingFields.push("invoiceNumber");
      if (!r.invoiceSeries) missingFields.push("invoiceSeries");
      if (!r.invoiceDate) missingFields.push("invoiceDate");
      if (!r.sellerTaxCode && !r.supplier?.taxCode) missingFields.push("sellerTaxCode");
      return {
        receiptId: r.id,
        receiptNo: r.receiptNo,
        receiptDate: isoDate(r.date),
        confirmedAt: isoDate(r.confirmedAt),
        warehouseId: r.warehouseId,
        warehouseCode: r.warehouse.code,
        supplierId: r.supplier?.id ?? null,
        supplier: r.supplier?.name ?? null,
        sellerTaxCode: r.sellerTaxCode ?? r.supplier?.taxCode ?? null,
        invoiceSeries: r.invoiceSeries,
        invoiceNumber: r.invoiceNumber,
        invoiceDate: isoDate(r.invoiceDate),
        legacyInvoiceNo: r.purchaseInvoiceNo,
        lineCount: r._count.items,
        totalAmount: money(r.totalAmount),
        missingFields
      };
    });

    const masked = maskReport(data, costVisible);
    const meta = await buildReportMeta(this.prisma, user, {
      referenceDate: query.toDate ?? new Date(),
      period: { from: query.fromDate ?? null, to: query.toDate ?? null },
      filters: { fromDate: query.fromDate, toDate: query.toDate, warehouseId: query.warehouseId, supplierId: query.supplierId, mode: query.mode },
      extra: { missingCount: total, gatePassed: total === 0 }
    });
    return { meta, data: masked, page: buildPage(query.page, query.limit, total) };
  }

  /** Issue lines that consumed a lot whose purchase invoice is dated after the sales invoice (AVERAGE: warning only). */
  async invoiceDateWarnings(query: InvoiceDateWarningsQuery, user: JwtUser): Promise<ReportEnvelope<Record<string, unknown>>> {
    const costVisible = canViewCost(user);
    const range = dateRange(query.fromDate, query.toDate);
    const where: Prisma.StockIssueLotConsumptionWhereInput = {
      invoiceDateWarning: true,
      issueItem: {
        ...(query.materialId ? { materialId: query.materialId } : {}),
        issue: {
          deletedAt: null,
          status: query.includeCancelled ? { in: ["CONFIRMED", "CANCELLED"] } : "CONFIRMED",
          ...(query.projectId ? { projectId: query.projectId } : {}),
          ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
          ...(range ? { date: range } : {})
        }
      }
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.stockIssueLotConsumption.count({ where }),
      this.prisma.stockIssueLotConsumption.findMany({
        where,
        select: {
          id: true,
          stockLotId: true,
          quantity: true,
          lotUnitPrice: true,
          issueItem: {
            select: {
              id: true,
              material: { select: { id: true, code: true, name: true, unit: true } },
              issue: {
                select: {
                  id: true, issueNo: true, date: true, status: true, warehouseId: true,
                  project: { select: { id: true, code: true, name: true, salesInvoiceDate: true } },
                  allocation: { select: { salesInvoiceDate: true, salesInvoiceNo: true } }
                }
              }
            }
          },
          stockLot: {
            select: {
              purchaseInvoiceDate: true,
              purchaseInvoiceNo: true,
              stockReceiptItem: {
                select: {
                  receipt: {
                    select: {
                      id: true, receiptNo: true, invoiceSeries: true, invoiceNumber: true, invoiceDate: true, sellerTaxCode: true,
                      supplier: { select: { id: true, name: true, taxCode: true } }
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: [{ issueItem: { issue: { date: "asc" } } }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit
      })
    ]);

    const data = rows.map((row) => {
      const issue = row.issueItem.issue;
      const receipt = row.stockLot.stockReceiptItem?.receipt;
      // Sales-invoice date basis per spec §2.3: allocation first, then project, else not determinable.
      const salesInvoiceDate = issue.allocation?.salesInvoiceDate ?? issue.project?.salesInvoiceDate ?? null;
      const basis = salesInvoiceDate ?? issue.date;
      const daysPurchaseAfterSale = Math.ceil((row.stockLot.purchaseInvoiceDate.getTime() - basis.getTime()) / DAY_MS);
      return {
        consumptionId: row.id,
        issueId: issue.id,
        issueNo: issue.issueNo,
        issueDate: isoDate(issue.date),
        issueStatus: issue.status,
        warehouseId: issue.warehouseId,
        projectId: issue.project?.id ?? null,
        projectCode: issue.project?.code ?? null,
        projectName: issue.project?.name ?? null,
        salesInvoiceDate: isoDate(salesInvoiceDate),
        salesInvoiceNo: issue.allocation?.salesInvoiceNo ?? null,
        salesDateBasis: salesInvoiceDate ? "SALES_INVOICE" : "ISSUE_DATE",
        materialId: row.issueItem.material.id,
        materialCode: row.issueItem.material.code,
        materialName: row.issueItem.material.name,
        unit: row.issueItem.material.unit,
        quantity: qty(row.quantity),
        lotUnitPrice: money(row.lotUnitPrice),
        amount: money(new Decimal(row.quantity).mul(row.lotUnitPrice)),
        sourceReceiptLotId: row.stockLotId,
        sourceReceiptId: receipt?.id ?? null,
        sourceReceiptNo: receipt?.receiptNo ?? null,
        supplier: receipt?.supplier?.name ?? null,
        sellerTaxCode: receipt?.sellerTaxCode ?? receipt?.supplier?.taxCode ?? null,
        invoiceSeries: receipt?.invoiceSeries ?? null,
        invoiceNumber: receipt?.invoiceNumber ?? row.stockLot.purchaseInvoiceNo,
        lotPurchaseInvoiceDate: isoDate(row.stockLot.purchaseInvoiceDate),
        daysPurchaseAfterSale
      };
    });

    const masked = maskReport(data, costVisible);
    const meta = await buildReportMeta(this.prisma, user, {
      referenceDate: query.toDate ?? new Date(),
      period: { from: query.fromDate ?? null, to: query.toDate ?? null },
      filters: { fromDate: query.fromDate, toDate: query.toDate, projectId: query.projectId, materialId: query.materialId, warehouseId: query.warehouseId, includeCancelled: query.includeCancelled ?? false }
    });
    return { meta, data: masked, page: buildPage(query.page, query.limit, total) };
  }
}
