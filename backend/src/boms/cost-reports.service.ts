import { Injectable, NotFoundException } from "@nestjs/common";
import type { CostGroup } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import { COST_GROUP_ORDER, lineAmount } from "./bom-cost";
import { loadLineGraph, totalsFromGraph } from "./bom-graph";
import { findAccessibleProject } from "./project-access";
import { selectEstimateBoms } from "./estimate-basis";

/** Standard Vietnamese VAT rate, also the Quote.taxRate default in the schema. */
const DEFAULT_VAT_RATE = 10;

function pct(numerator: Decimal, denominator: Decimal): number | null {
  if (denominator.lte(0)) return null;
  return numerator.div(denominator).mul(100).toDecimalPlaces(1).toNumber();
}

@Injectable()
export class CostReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GĐ3: revenue vs material cost vs direct cost, plus estimate-vs-actual by group and by BOM line. */
  async getCostSummary(projectId: string, user: JwtUser, bomId?: string) {
    await findAccessibleProject(this.prisma, projectId, user);

    const [contract, acceptedQuote, allocations, costs, boms] = await Promise.all([
      this.prisma.contract.findFirst({
        where: { projectId, deletedAt: null },
        select: {
          id: true, contractNo: true, value: true,
          items: { select: { total: true, quoteItem: { select: { quote: { select: { taxRate: true } } } } } }
        }
      }),
      this.prisma.quote.findFirst({
        where: { projectId, status: "ACCEPTED", deletedAt: null },
        orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, quoteNo: true, subtotal: true, taxRate: true, acceptedItemIds: true, items: { select: { id: true, total: true } } }
      }),
      this.prisma.projectMaterialAllocation.findMany({
        where: { projectId, status: "CONFIRMED" },
        orderBy: { salesInvoiceDate: "asc" },
        select: {
          id: true,
          salesInvoiceNo: true,
          salesInvoiceDate: true,
          items: { select: { bomLineId: true, total: true, bomLine: { select: { group: true } } } }
        }
      }),
      this.prisma.projectCost.findMany({
        where: { projectId, deletedAt: null },
        select: { group: true, amount: true, bomLineId: true }
      }),
      this.prisma.bom.findMany({
        where: { projectId, kind: "PROJECT", deletedAt: null, status: { not: "ARCHIVED" }, ...(bomId ? { id: bomId } : {}) },
        select: { id: true, code: true, name: true, status: true, sourceBomId: true, version: true }
      })
    ]);

    // Revenue is shown before VAT, to compare against costs which are also before VAT.
    let revenue = new Decimal(0);
    let revenueSource: "CONTRACT" | "QUOTE" | "NONE" = "NONE";
    let revenueRef: { id: string; no: string } | null = null;
    // Contract value includes VAT. When no source quote tells us the rate, assume the
    // standard rate instead of treating the gross value as net (would inflate margin ~10%).
    let revenueVatAssumed = false;
    const fallbackTaxRate = acceptedQuote ? new Decimal(acceptedQuote.taxRate) : new Decimal(DEFAULT_VAT_RATE);
    if (contract) {
      // A later accepted quote may use a different VAT rate from the contract's source items.
      const netItems = contract.items.reduce((sum, item) => sum.plus(item.total), new Decimal(0));
      const grossItems = contract.items.reduce((sum, item) => {
        const sourceRate = item.quoteItem?.quote.taxRate;
        if (sourceRate === undefined && !acceptedQuote) revenueVatAssumed = true;
        const rate = sourceRate ?? fallbackTaxRate;
        return sum.plus(new Decimal(item.total).mul(new Decimal(rate).div(100).plus(1)));
      }, new Decimal(0));
      if (!(netItems.gt(0) && grossItems.gt(0)) && !acceptedQuote) revenueVatAssumed = true;
      revenue = netItems.gt(0) && grossItems.gt(0)
        ? new Decimal(contract.value).mul(netItems).div(grossItems).toDecimalPlaces(0)
        : new Decimal(contract.value).div(fallbackTaxRate.div(100).plus(1)).toDecimalPlaces(0);
      revenueSource = "CONTRACT";
      revenueRef = { id: contract.id, no: contract.contractNo };
    } else if (acceptedQuote) {
      const accepted = new Set(acceptedQuote.acceptedItemIds ?? []);
      revenue =
        accepted.size > 0
          ? acceptedQuote.items.filter((item) => accepted.has(item.id)).reduce((sum, item) => sum.plus(item.total), new Decimal(0))
          : new Decimal(acceptedQuote.subtotal);
      revenueSource = "QUOTE";
      revenueRef = { id: acceptedQuote.id, no: acceptedQuote.quoteNo };
    }

    // Actuals
    const actualByGroup = new Map<CostGroup, Decimal>();
    const actualByLine = new Map<string, Decimal>();
    let materialCost = new Decimal(0);
    let unassignedMaterial = new Decimal(0);
    for (const allocation of allocations) {
      for (const item of allocation.items) {
        const total = new Decimal(item.total);
        materialCost = materialCost.plus(total);
        const group: CostGroup = item.bomLine?.group ?? "OTHER";
        actualByGroup.set(group, (actualByGroup.get(group) ?? new Decimal(0)).plus(total));
        if (item.bomLineId) {
          actualByLine.set(item.bomLineId, (actualByLine.get(item.bomLineId) ?? new Decimal(0)).plus(total));
        } else {
          unassignedMaterial = unassignedMaterial.plus(total);
        }
      }
    }
    let directCost = new Decimal(0);
    let unassignedDirect = new Decimal(0);
    for (const cost of costs) {
      const amount = new Decimal(cost.amount);
      directCost = directCost.plus(amount);
      actualByGroup.set(cost.group, (actualByGroup.get(cost.group) ?? new Decimal(0)).plus(amount));
      if (cost.bomLineId) {
        actualByLine.set(cost.bomLineId, (actualByLine.get(cost.bomLineId) ?? new Decimal(0)).plus(amount));
      } else {
        unassignedDirect = unassignedDirect.plus(amount);
      }
    }

    const usedBoms = selectEstimateBoms(boms);
    const estimateBasis: "APPROVED" | "DRAFT" | "NONE" =
      usedBoms.some((bom) => bom.status === "APPROVED") ? "APPROVED" : usedBoms.length ? "DRAFT" : "NONE";

    const graph = await loadLineGraph(this.prisma, usedBoms.map((bom) => bom.id));
    const totalsMap = totalsFromGraph(graph);
    const estimatedByGroup = new Map<CostGroup, Decimal>();
    let estimatedCost = new Decimal(0);
    const byLine: Array<{
      bomId: string;
      bomCode: string;
      bomLineId: string;
      order: number;
      group: CostGroup;
      name: string;
      estimated: number;
      actual: number;
      variance: number;
    }> = [];

    for (const bom of usedBoms) {
      const lines = graph.get(bom.id) ?? [];
      const childTotals = new Map<string, number>();
      for (const line of lines) {
        if (line.childBomId) childTotals.set(line.childBomId, totalsMap.get(line.childBomId)?.total ?? 0);
      }
      for (const line of lines) {
        const estimated = lineAmount(line, childTotals);
        const actual = actualByLine.get(line.id) ?? new Decimal(0);
        estimatedCost = estimatedCost.plus(estimated);
        estimatedByGroup.set(line.group, (estimatedByGroup.get(line.group) ?? new Decimal(0)).plus(estimated));
        byLine.push({
          bomId: bom.id,
          bomCode: bom.code,
          bomLineId: line.id,
          order: line.order,
          group: line.group,
          name: line.name,
          estimated: estimated.toNumber(),
          actual: actual.toNumber(),
          variance: actual.minus(estimated).toNumber()
        });
      }
    }

    const byGroup = COST_GROUP_ORDER.filter((group) => estimatedByGroup.has(group) || actualByGroup.has(group)).map(
      (group) => {
        const estimated = estimatedByGroup.get(group) ?? new Decimal(0);
        const actual = actualByGroup.get(group) ?? new Decimal(0);
        return { group, estimated: estimated.toNumber(), actual: actual.toNumber(), variance: actual.minus(estimated).toNumber() };
      }
    );

    const totalCost = materialCost.plus(directCost);
    const grossProfit = revenue.minus(totalCost);
    const estimatedProfit = revenue.minus(estimatedCost);

    return {
      projectId,
      revenue: revenue.toNumber(),
      revenueSource,
      revenueVatAssumed,
      revenueVatRate: revenueVatAssumed ? DEFAULT_VAT_RATE : null,
      revenueRef,
      materialCost: materialCost.toNumber(),
      directCost: directCost.toNumber(),
      totalCost: totalCost.toNumber(),
      grossProfit: grossProfit.toNumber(),
      grossMarginPct: pct(grossProfit, revenue),
      estimatedCost: estimatedCost.toNumber(),
      estimatedProfit: estimatedProfit.toNumber(),
      estimatedMarginPct: pct(estimatedProfit, revenue),
      estimateBasis,
      boms: usedBoms.map((bom) => ({ id: bom.id, code: bom.code, name: bom.name, status: bom.status })),
      byGroup,
      byLine,
      unassigned: { materialCost: unassignedMaterial.toNumber(), directCost: unassignedDirect.toNumber() },
      allocations: allocations.map((allocation) => ({
        id: allocation.id,
        salesInvoiceNo: allocation.salesInvoiceNo,
        salesInvoiceDate: allocation.salesInvoiceDate,
        materialCost: allocation.items.reduce((sum, item) => sum + decimalToNumber(item.total), 0)
      }))
    };
  }

  /** GĐ3: data for "Bảng kê giá vốn hóa đơn bán số …" (frontend renders the Excel file). */
  async getCostSheet(allocationId: string, user: JwtUser) {
    const allocation = await this.prisma.projectMaterialAllocation.findFirst({
      where: { id: allocationId },
      select: {
        id: true,
        projectId: true,
        salesInvoiceNo: true,
        salesInvoiceDate: true,
        status: true,
        notes: true,
        confirmedAt: true,
        project: { select: { id: true, code: true, name: true, customer: { select: { id: true, name: true } } } },
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            material: { select: { id: true, code: true, name: true, unit: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            bomLine: { select: { id: true, name: true, group: true } },
            stockLot: {
              select: {
                purchaseInvoiceDate: true,
                purchaseInvoiceNo: true,
                stockReceiptItem: { select: { receipt: { select: { receiptNo: true, purchaseInvoiceNo: true } } } }
              }
            }
          }
        },
        costs: {
          where: { deletedAt: null },
          orderBy: { invoiceDate: "asc" },
          select: {
            id: true,
            group: true,
            description: true,
            invoiceNo: true,
            invoiceDate: true,
            amount: true,
            vatRate: true,
            supplier: { select: { id: true, name: true } }
          }
        }
      }
    });
    if (!allocation) throw new NotFoundException("Không tìm thấy đợt phân bổ");
    await findAccessibleProject(this.prisma, allocation.projectId, user);

    const materialRows = allocation.items.map((item, index) => ({
      stt: index + 1,
      materialCode: item.material.code,
      materialName: item.material.name,
      unit: item.material.unit,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      total: decimalToNumber(item.total),
      warehouse: item.warehouse.name,
      bomLine: item.bomLine,
      purchaseInvoiceNo:
        item.stockLot.purchaseInvoiceNo ?? item.stockLot.stockReceiptItem?.receipt.purchaseInvoiceNo ?? null,
      purchaseInvoiceDate: item.stockLot.purchaseInvoiceDate,
      receiptNo: item.stockLot.stockReceiptItem?.receipt.receiptNo ?? null
    }));
    const costRows = allocation.costs.map((cost, index) => ({
      stt: index + 1,
      group: cost.group,
      description: cost.description,
      supplier: cost.supplier?.name ?? null,
      invoiceNo: cost.invoiceNo,
      invoiceDate: cost.invoiceDate,
      amount: decimalToNumber(cost.amount),
      vatRate: cost.vatRate === null ? null : decimalToNumber(cost.vatRate)
    }));
    const materialTotal = materialRows.reduce((sum, row) => sum + row.total, 0);
    const costTotal = costRows.reduce((sum, row) => sum + row.amount, 0);

    return {
      allocation: {
        id: allocation.id,
        salesInvoiceNo: allocation.salesInvoiceNo,
        salesInvoiceDate: allocation.salesInvoiceDate,
        status: allocation.status,
        notes: allocation.notes,
        confirmedAt: allocation.confirmedAt
      },
      project: { id: allocation.project.id, code: allocation.project.code, name: allocation.project.name },
      customer: allocation.project.customer,
      materials: materialRows,
      costs: costRows,
      totals: { materialTotal, costTotal, grandTotal: materialTotal + costTotal }
    };
  }
}
