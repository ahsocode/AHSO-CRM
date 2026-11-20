import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { JwtUser } from "../auth/auth.types";
import { findAccessibleProject } from "../boms/project-access";
import { PrismaService } from "../common/prisma.service";
import { canViewCost } from "../inventory/inventory-controls";
import { buildWhere } from "../projects/project-where";
import type {
  InventoryValuationQuery,
  ProjectCostQuery,
  StockLedgerQuery
} from "./inventory-reports.dto";
import { loadMovementEvents, type LedgerMeta, type LotSource } from "./movement-loader";
import { replayMovements, type ReplayedEvent } from "./movement-replay";
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

const ACCOUNTING_CLASS_INFO: Record<string, { account: string | null; label: string; order: number }> = {
  RAW_MATERIAL: { account: "152", label: "Nguyên vật liệu", order: 1 },
  TOOL: { account: "153", label: "Công cụ, dụng cụ", order: 2 },
  FINISHED_GOOD: { account: "155", label: "Thành phẩm", order: 3 },
  MERCHANDISE: { account: "156", label: "Hàng hóa", order: 4 },
  CONSUMABLE_COMMON: { account: null, label: "Vật tư phụ dùng chung", order: 5 },
  UNCLASSIFIED: { account: null, label: "Chưa phân loại", order: 6 }
};

const COST_GROUP_ORDER = ["MECHANICAL", "ELECTRICAL", "VISION", "SOFTWARE", "LABOR", "OUTSOURCE", "SHIPPING", "TRAVEL", "OTHER"];

function sourceJson(source: LotSource) {
  return {
    sourceReceiptLotId: source.sourceReceiptLotId,
    sourceReceiptId: source.receiptId,
    sourceReceiptNo: source.receiptNo,
    supplierId: source.supplierId,
    supplier: source.supplierName,
    sellerTaxCode: source.sellerTaxCode,
    invoiceSeries: source.invoiceSeries,
    invoiceNumber: source.invoiceNumber,
    invoiceDate: isoDate(source.invoiceDate),
    lotPurchaseInvoiceDate: isoDate(source.lotPurchaseInvoiceDate),
    quantity: qty(source.quantity),
    lotUnitPrice: money(source.lotUnitPrice),
    invoiceDateWarning: source.invoiceDateWarning
  };
}

const CONSUMPTION_SELECT = {
  stockLotId: true,
  quantity: true,
  lotUnitPrice: true,
  invoiceDateWarning: true,
  stockLot: {
    select: {
      purchaseInvoiceDate: true,
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
} satisfies Prisma.StockIssueLotConsumptionSelect;
type ConsumptionRow = Prisma.StockIssueLotConsumptionGetPayload<{ select: typeof CONSUMPTION_SELECT }>;

interface ValuationRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  accountingClass: string | null;
  quantity: Decimal;
  costPrice: Decimal;
}

function accountingClassWhere(value: string | undefined): Prisma.MaterialWhereInput | undefined {
  if (!value) return undefined;
  return value === "UNCLASSIFIED"
    ? { accountingClass: null }
    : { accountingClass: value as Prisma.EnumAccountingClassNullableFilter["equals"] };
}

@Injectable()
export class InventoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── stock ledger ───────────────────────────

  async stockLedger(query: StockLedgerQuery, user: JwtUser): Promise<ReportEnvelope<Record<string, unknown>>> {
    const from = startOfDayUtc(query.fromDate);
    const to = endOfDayUtc(query.toDate);
    const costVisible = canViewCost(user);

    const events = await loadMovementEvents(this.prisma, {
      materialIds: query.materialId ? [query.materialId] : undefined,
      toDate: to,
      detail: true
    });
    // The moving average is per material over every warehouse, so replay first and filter the warehouse afterwards.
    const { events: replayed } = replayMovements(events);
    const scoped = query.warehouseId ? replayed.filter((e) => e.warehouseId === query.warehouseId) : replayed;

    interface Account {
      materialId: string;
      warehouseId: string;
      openingQty: Decimal;
      openingValue: Decimal;
      closingQty: Decimal;
      closingValue: Decimal;
      inQty: Decimal;
      outQty: Decimal;
      lines: ReplayedEvent<LedgerMeta>[];
    }
    const accounts = new Map<string, Account>();
    for (const event of scoped) {
      const key = `${event.materialId}|${event.warehouseId}`;
      let account = accounts.get(key);
      if (!account) {
        account = {
          materialId: event.materialId,
          warehouseId: event.warehouseId,
          openingQty: new Decimal(0),
          openingValue: new Decimal(0),
          closingQty: new Decimal(0),
          closingValue: new Decimal(0),
          inQty: new Decimal(0),
          outQty: new Decimal(0),
          lines: []
        };
        accounts.set(key, account);
      }
      if (event.eventDate.getTime() < from.getTime()) {
        account.openingQty = event.accountQtyAfter;
        account.openingValue = event.accountValueAfter;
      } else {
        account.lines.push(event);
        if (event.quantity.greaterThan(0)) account.inQty = account.inQty.plus(event.quantity);
        else account.outQty = account.outQty.plus(event.quantity.abs());
      }
      account.closingQty = event.accountQtyAfter;
      account.closingValue = event.accountValueAfter;
    }

    const relevant = [...accounts.values()].filter((a) => a.lines.length > 0 || !a.closingQty.isZero() || !a.openingQty.isZero());
    const [materials, warehouses] = await Promise.all([
      this.prisma.material.findMany({
        where: { id: { in: [...new Set(relevant.map((a) => a.materialId))] } },
        select: { id: true, code: true, name: true, unit: true }
      }),
      this.prisma.warehouse.findMany({
        where: { id: { in: [...new Set(relevant.map((a) => a.warehouseId))] } },
        select: { id: true, code: true, name: true }
      })
    ]);
    const materialById = new Map(materials.map((m) => [m.id, m]));
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

    relevant.sort((a, b) => {
      const ma = materialById.get(a.materialId)?.code ?? a.materialId;
      const mb = materialById.get(b.materialId)?.code ?? b.materialId;
      const wa = warehouseById.get(a.warehouseId)?.code ?? a.warehouseId;
      const wb = warehouseById.get(b.warehouseId)?.code ?? b.warehouseId;
      return ma.localeCompare(mb) || wa.localeCompare(wb);
    });

    const allLines = relevant.flatMap((account) => account.lines);
    const total = allLines.length;
    const start = (query.page - 1) * query.limit;
    const pageLines = allLines.slice(start, start + query.limit);

    const data = pageLines.map((e) => {
      const material = materialById.get(e.materialId);
      const warehouse = warehouseById.get(e.warehouseId);
      const meta = e.meta;
      const single = meta.sources.length === 1 ? meta.sources[0] : null;
      const invoice = meta.invoice;
      const isIn = e.quantity.greaterThan(0);
      return {
        warehouseId: e.warehouseId,
        warehouseCode: warehouse?.code ?? null,
        materialId: e.materialId,
        materialCode: material?.code ?? null,
        materialName: material?.name ?? null,
        unit: material?.unit ?? null,
        date: isoDate(e.eventDate),
        eventType: e.kind,
        reversal: meta.reversal,
        documentType: meta.documentType,
        documentId: meta.documentId,
        documentNo: meta.documentNo,
        lineId: meta.lineId,
        documentDate: isoDate(meta.documentDate),
        subType: meta.subType,
        projectId: meta.projectId,
        counterpartyWarehouseId: meta.counterpartyWarehouseId,
        qtyIn: isIn ? qty(e.quantity) : 0,
        qtyOut: isIn ? 0 : qty(e.quantity.abs()),
        unitPrice: money(e.unitCost),
        amount: money(e.value),
        balanceQty: qty(e.accountQtyAfter),
        balanceValue: money(e.accountValueAfter),
        // Invoice of the receipt (receipt lines) or of the single source lot (issue lines).
        supplierId: invoice?.supplierId ?? null,
        supplier: invoice?.supplierName ?? null,
        sellerTaxCode: invoice?.sellerTaxCode ?? null,
        invoiceSeries: invoice?.invoiceSeries ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        invoiceDate: isoDate(invoice?.invoiceDate),
        sourceReceiptId: invoice?.receiptId ?? null,
        // Issue lines: lot id when exactly one lot was consumed, null otherwise (see sources[]).
        sourceReceiptLotId: single?.sourceReceiptLotId ?? null,
        sources: meta.sources.map(sourceJson)
      };
    });

    const accountSummaries = relevant.map((a) => ({
      warehouseId: a.warehouseId,
      warehouseCode: warehouseById.get(a.warehouseId)?.code ?? null,
      materialId: a.materialId,
      materialCode: materialById.get(a.materialId)?.code ?? null,
      materialName: materialById.get(a.materialId)?.name ?? null,
      unit: materialById.get(a.materialId)?.unit ?? null,
      openingQty: qty(a.openingQty),
      openingValue: money(a.openingValue),
      inQty: qty(a.inQty),
      outQty: qty(a.outQty),
      closingQty: qty(a.closingQty),
      closingValue: money(a.closingValue),
      lineCount: a.lines.length
    }));

    const masked = maskReport({ data, accounts: accountSummaries }, costVisible);
    const meta = await buildReportMeta(this.prisma, user, {
      referenceDate: to,
      period: { from, to },
      filters: { materialId: query.materialId, warehouseId: query.warehouseId, fromDate: query.fromDate, toDate: query.toDate },
      extra: {
        accounts: masked.accounts,
        valuationBasis:
          "Giá trị dòng: phiếu nhập/xuất theo giá chứng từ; chuyển kho và kiểm kê theo giá bình quân di động tại thời điểm. " +
          "Tồn đầu/cuối kỳ = số lượng cộng dồn × giá bình quân di động sau chứng từ cuối cùng. Phiếu xuất đã hủy hiện hai dòng (xuất + đảo)."
      }
    });
    return { meta, data: masked.data, page: buildPage(query.page, query.limit, total) };
  }

  // ───────────────────────── inventory valuation ─────────────────────────

  private async liveRows(query: InventoryValuationQuery): Promise<ValuationRow[]> {
    const materialWhere = accountingClassWhere(query.accountingClass);
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        quantity: { not: 0 },
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.materialId ? { materialId: query.materialId } : {}),
        ...(materialWhere ? { material: materialWhere } : {})
      },
      select: {
        warehouseId: true,
        materialId: true,
        quantity: true,
        warehouse: { select: { code: true, name: true } },
        material: { select: { code: true, name: true, unit: true, costPrice: true, accountingClass: true } }
      },
      orderBy: [{ warehouseId: "asc" }, { materialId: "asc" }]
    });
    return balances.map((b) => ({
      warehouseId: b.warehouseId,
      warehouseCode: b.warehouse.code,
      warehouseName: b.warehouse.name,
      materialId: b.materialId,
      materialCode: b.material.code,
      materialName: b.material.name,
      unit: b.material.unit,
      accountingClass: b.material.accountingClass,
      quantity: new Decimal(b.quantity),
      costPrice: new Decimal(b.material.costPrice)
    }));
  }

  /** Past date: replay confirmed movements (date <= asOf) with the same moving-average formula. */
  private async replayRows(
    asOfEnd: Date,
    query: InventoryValuationQuery
  ): Promise<{ rows: ValuationRow[]; replayedNowTotal: Decimal }> {
    let materialIds: string[] | undefined = query.materialId ? [query.materialId] : undefined;
    const materialWhere = accountingClassWhere(query.accountingClass);
    if (materialWhere) {
      const matches = await this.prisma.material.findMany({
        where: { ...materialWhere, ...(query.materialId ? { id: query.materialId } : {}) },
        select: { id: true }
      });
      materialIds = matches.map((m) => m.id);
    }

    const events = await loadMovementEvents(this.prisma, { materialIds, detail: false });
    const atDate = replayMovements(events.filter((e) => e.eventDate.getTime() <= asOfEnd.getTime()));
    const upToNow = replayMovements(events);

    const warehouseFilter = query.warehouseId;
    const picked: Array<{ warehouseId: string; materialId: string; quantity: Decimal; avg: Decimal }> = [];
    for (const [materialId, state] of atDate.materials) {
      for (const [warehouseId, quantity] of state.byWarehouse) {
        if (quantity.isZero()) continue;
        if (warehouseFilter && warehouseId !== warehouseFilter) continue;
        picked.push({ warehouseId, materialId, quantity, avg: state.avg });
      }
    }

    let replayedNowTotal = new Decimal(0);
    for (const state of upToNow.materials.values()) {
      for (const [warehouseId, quantity] of state.byWarehouse) {
        if (warehouseFilter && warehouseId !== warehouseFilter) continue;
        replayedNowTotal = replayedNowTotal.plus(quantity.mul(state.avg));
      }
    }

    const [materials, warehouses] = await Promise.all([
      this.prisma.material.findMany({
        where: { id: { in: [...new Set(picked.map((p) => p.materialId))] } },
        select: { id: true, code: true, name: true, unit: true, accountingClass: true }
      }),
      this.prisma.warehouse.findMany({
        where: { id: { in: [...new Set(picked.map((p) => p.warehouseId))] } },
        select: { id: true, code: true, name: true }
      })
    ]);
    const materialById = new Map(materials.map((m) => [m.id, m]));
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

    const rows: ValuationRow[] = picked.flatMap((p) => {
      const material = materialById.get(p.materialId);
      const warehouse = warehouseById.get(p.warehouseId);
      if (!material || !warehouse) return [];
      return [
        {
          warehouseId: p.warehouseId,
          warehouseCode: warehouse.code,
          warehouseName: warehouse.name,
          materialId: p.materialId,
          materialCode: material.code,
          materialName: material.name,
          unit: material.unit,
          accountingClass: material.accountingClass,
          quantity: p.quantity,
          costPrice: p.avg
        }
      ];
    });
    return { rows, replayedNowTotal };
  }

  async inventoryValuation(query: InventoryValuationQuery, user: JwtUser): Promise<ReportEnvelope<Record<string, unknown>>> {
    const today = startOfDayUtc(new Date());
    const asOf = query.asOfDate ? startOfDayUtc(query.asOfDate) : today;
    const live = asOf.getTime() >= today.getTime();
    const costVisible = canViewCost(user);

    let rows: ValuationRow[];
    let reconciliationDiff: number | null = null;
    if (live) {
      rows = await this.liveRows(query);
    } else {
      const replay = await this.replayRows(endOfDayUtc(asOf), query);
      rows = replay.rows;
      const liveRows = await this.liveRows(query);
      const liveTotal = liveRows.reduce((sum, r) => sum.plus(r.quantity.mul(r.costPrice)), new Decimal(0));
      reconciliationDiff = money(replay.replayedNowTotal.minus(liveTotal));
    }
    rows.sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode) || a.materialCode.localeCompare(b.materialCode));

    // Same formula as get_inventory_summary: sum(quantity x costPrice) then round once.
    const rawTotal = rows.reduce((sum, r) => sum.plus(r.quantity.mul(r.costPrice)), new Decimal(0));
    const unclassified = new Set(rows.filter((r) => !r.accountingClass).map((r) => r.materialId));
    const materialCount = new Set(rows.map((r) => r.materialId)).size;

    let grouped: Array<Record<string, unknown>>;
    if (query.groupBy === "accountingClass") {
      const map = new Map<string, { value: Decimal; materials: Set<string> }>();
      for (const r of rows) {
        const key = r.accountingClass ?? "UNCLASSIFIED";
        const entry = map.get(key) ?? { value: new Decimal(0), materials: new Set<string>() };
        entry.value = entry.value.plus(r.quantity.mul(r.costPrice));
        entry.materials.add(r.materialId);
        map.set(key, entry);
      }
      grouped = [...map.entries()]
        .sort((a, b) => (ACCOUNTING_CLASS_INFO[a[0]]?.order ?? 99) - (ACCOUNTING_CLASS_INFO[b[0]]?.order ?? 99))
        .map(([key, entry]) => ({
          accountingClass: key === "UNCLASSIFIED" ? null : key,
          account: ACCOUNTING_CLASS_INFO[key]?.account ?? null,
          label: ACCOUNTING_CLASS_INFO[key]?.label ?? key,
          materialCount: entry.materials.size,
          value: money(entry.value)
        }));
    } else if (query.groupBy === "warehouse") {
      const map = new Map<string, { code: string; name: string; value: Decimal; materials: Set<string> }>();
      for (const r of rows) {
        const entry = map.get(r.warehouseId) ?? { code: r.warehouseCode, name: r.warehouseName, value: new Decimal(0), materials: new Set<string>() };
        entry.value = entry.value.plus(r.quantity.mul(r.costPrice));
        entry.materials.add(r.materialId);
        map.set(r.warehouseId, entry);
      }
      grouped = [...map.entries()].map(([warehouseId, entry]) => ({
        warehouseId,
        warehouseCode: entry.code,
        warehouseName: entry.name,
        materialCount: entry.materials.size,
        value: money(entry.value)
      }));
    } else {
      grouped = rows.map((r) => ({
        warehouseId: r.warehouseId,
        warehouseCode: r.warehouseCode,
        warehouseName: r.warehouseName,
        materialId: r.materialId,
        materialCode: r.materialCode,
        materialName: r.materialName,
        unit: r.unit,
        accountingClass: r.accountingClass,
        quantity: qty(r.quantity),
        costPrice: money(r.costPrice),
        value: money(r.quantity.mul(r.costPrice))
      }));
    }

    const total = grouped.length;
    const start = (query.page - 1) * query.limit;
    const data = grouped.slice(start, start + query.limit);

    const warnings: string[] = [];
    if (unclassified.size > 0) warnings.push(`${unclassified.size} vật tư chưa có nhóm hạch toán (accountingClass) — xếp vào "Chưa phân loại"`);
    if (reconciliationDiff !== null && reconciliationDiff !== 0) {
      warnings.push("Dựng lại sổ đến hôm nay lệch với giá bình quân hiện tại (xem reconciliationDiff); số liệu quá khứ chỉ mang tính tham khảo");
    }

    const masked = maskReport(
      {
        data,
        totals: { totalValue: money(rawTotal), lineCount: rows.length, materialCount, unclassifiedMaterialCount: unclassified.size },
        reconciliationDiff
      },
      costVisible
    );
    const meta = await buildReportMeta(this.prisma, user, {
      referenceDate: asOf,
      asOfDate: asOf,
      filters: { asOfDate: asOf, warehouseId: query.warehouseId, materialId: query.materialId, accountingClass: query.accountingClass, groupBy: query.groupBy },
      extra: {
        valuationMethod: live ? "LIVE_COST_PRICE" : "REPLAY_MOVING_AVERAGE",
        valuationMethodNote: live
          ? "Số lượng tồn hiện tại × Material.costPrice (cùng công thức get_inventory_summary; tổng làm tròn một lần ở cuối)."
          : "Dựng lại từ phiếu nhập/xuất/chuyển/kiểm kê đã xác nhận có ngày chứng từ ≤ asOfDate theo thứ tự thời gian, bình quân gia quyền di động (cùng công thức, cùng làm tròn). Phiếu xuất đã hủy tính xuất tại ngày phiếu và đảo tại ngày hủy.",
        groupBy: query.groupBy,
        totals: masked.totals,
        reconciliationDiff: masked.reconciliationDiff,
        warnings
      }
    });
    return { meta, data: masked.data, page: buildPage(query.page, query.limit, total) };
  }

  // ───────────────────────────── project cost ─────────────────────────────

  async projectCost(query: ProjectCostQuery, user: JwtUser): Promise<ReportEnvelope<Record<string, unknown>>> {
    const from = query.fromDate ? startOfDayUtc(query.fromDate) : null;
    const to = query.toDate ? endOfDayUtc(query.toDate) : null;
    const includeLines = query.includeLines ?? Boolean(query.projectId);
    const costVisible = canViewCost(user);
    const dateRange = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    let projects: Array<{ id: string; code: string; name: string; costRecognitionStatus: string }>;
    let total: number;
    if (query.projectId) {
      const accessible = await findAccessibleProject(this.prisma, query.projectId, user);
      const full = await this.prisma.project.findUnique({
        where: { id: accessible.id },
        select: { id: true, code: true, name: true, costRecognitionStatus: true }
      });
      projects = full ? [full] : [];
      total = projects.length;
    } else {
      const [issueGroups, costGroups] = await Promise.all([
        this.prisma.stockIssue.groupBy({
          by: ["projectId"],
          where: { status: "CONFIRMED", deletedAt: null, projectId: { not: null }, ...(dateRange ? { date: dateRange } : {}) }
        }),
        this.prisma.projectCost.groupBy({
          by: ["projectId"],
          where: { deletedAt: null, projectId: { not: null }, ...(dateRange ? { invoiceDate: dateRange } : {}) }
        })
      ]);
      const ids = [...new Set([...issueGroups, ...costGroups].map((g) => g.projectId).filter((id): id is string => Boolean(id)))];
      const visible = await this.prisma.project.findMany({
        where: { ...buildWhere({}, user), id: { in: ids } },
        select: { id: true, code: true, name: true, costRecognitionStatus: true },
        orderBy: [{ code: "asc" }, { id: "asc" }]
      });
      total = visible.length;
      projects = visible.slice((query.page - 1) * query.limit, query.page * query.limit);
    }

    const ids = projects.map((p) => p.id);
    const issueSelect = {
      id: true,
      materialId: true,
      quantity: true,
      unitPrice: true,
      total: true,
      material: { select: { code: true, name: true, unit: true } },
      issue: { select: { id: true, issueNo: true, date: true, projectId: true } },
      ...(includeLines ? { lotConsumptions: { select: CONSUMPTION_SELECT } } : {})
    } satisfies Prisma.StockIssueItemSelect;

    const [issueItems, warningCounts, returnItems, costGroups, costLines] = ids.length
      ? await Promise.all([
          this.prisma.stockIssueItem.findMany({
            where: { issue: { projectId: { in: ids }, status: "CONFIRMED", deletedAt: null, ...(dateRange ? { date: dateRange } : {}) } },
            select: issueSelect,
            orderBy: [{ issue: { date: "asc" } }, { id: "asc" }]
          }),
          this.prisma.stockIssueLotConsumption.findMany({
            where: {
              invoiceDateWarning: true,
              issueItem: { issue: { projectId: { in: ids }, status: "CONFIRMED", deletedAt: null, ...(dateRange ? { date: dateRange } : {}) } }
            },
            select: { issueItem: { select: { issue: { select: { projectId: true } } } } }
          }),
          this.prisma.stockReceiptItem.findMany({
            where: {
              receipt: {
                receiptType: "RETURN_FROM_PROJECT",
                status: "CONFIRMED",
                deletedAt: null,
                returnedFromIssue: { projectId: { in: ids }, status: "CONFIRMED" },
                ...(dateRange ? { date: dateRange } : {})
              }
            },
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              total: true,
              material: { select: { code: true, name: true, unit: true } },
              receipt: { select: { id: true, receiptNo: true, date: true, returnedFromIssue: { select: { projectId: true } } } }
            },
            orderBy: [{ receipt: { date: "asc" } }, { id: "asc" }]
          }),
          this.prisma.projectCost.groupBy({
            by: ["projectId", "group"],
            where: { projectId: { in: ids }, deletedAt: null, ...(dateRange ? { invoiceDate: dateRange } : {}) },
            _sum: { amount: true },
            _count: { _all: true }
          }),
          includeLines
            ? this.prisma.projectCost.findMany({
                where: { projectId: { in: ids }, deletedAt: null, ...(dateRange ? { invoiceDate: dateRange } : {}) },
                select: {
                  id: true, projectId: true, group: true, description: true, invoiceNo: true, invoiceSeries: true, invoiceNumber: true,
                  invoiceDate: true, sellerTaxCode: true, amount: true, vatRate: true, vatAmount: true,
                  supplier: { select: { id: true, name: true } }
                },
                orderBy: [{ invoiceDate: "asc" }, { id: "asc" }]
              })
            : Promise.resolve([])
        ])
      : [[], [], [], [], []];

    const rows = projects.map((project) => {
      const myIssues = issueItems.filter((i) => i.issue.projectId === project.id);
      const myReturns = returnItems.filter((r) => r.receipt.returnedFromIssue?.projectId === project.id);
      const materialCost = myIssues.reduce((sum, i) => sum.plus(i.total), new Decimal(0));
      const returnedCost = myReturns.reduce((sum, r) => sum.plus(r.total), new Decimal(0));
      const groups = costGroups
        .filter((g) => g.projectId === project.id)
        .sort((a, b) => COST_GROUP_ORDER.indexOf(a.group) - COST_GROUP_ORDER.indexOf(b.group));
      const directCost = groups.reduce((sum, g) => sum.plus(g._sum.amount ?? 0), new Decimal(0));
      const netMaterial = materialCost.minus(returnedCost);

      return {
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        costRecognitionStatus: project.costRecognitionStatus,
        materialCost: money(materialCost),
        returnedCost: money(returnedCost),
        netMaterialCost: money(netMaterial),
        directCost: money(directCost),
        totalCost: money(netMaterial.plus(directCost)),
        invoiceDateWarningCount: warningCounts.filter((w) => w.issueItem.issue.projectId === project.id).length,
        directCostByGroup: groups.map((g) => ({ group: g.group, amount: money(g._sum.amount), count: g._count._all })),
        ...(includeLines
          ? {
              materialLines: myIssues.map((i) => {
                const consumptions: ConsumptionRow[] = "lotConsumptions" in i ? (i.lotConsumptions as unknown as ConsumptionRow[]) : [];
                return {
                  issueId: i.issue.id,
                  issueNo: i.issue.issueNo,
                  date: isoDate(i.issue.date),
                  lineId: i.id,
                  materialId: i.materialId,
                  materialCode: i.material.code,
                  materialName: i.material.name,
                  unit: i.material.unit,
                  quantity: qty(i.quantity),
                  unitPrice: money(i.unitPrice),
                  amount: money(i.total),
                  invoiceDateWarning: consumptions.some((c) => c.invoiceDateWarning),
                  sources: consumptions.map((c) => {
                    const receipt = c.stockLot.stockReceiptItem?.receipt;
                    return {
                      sourceReceiptLotId: c.stockLotId,
                      sourceReceiptId: receipt?.id ?? null,
                      sourceReceiptNo: receipt?.receiptNo ?? null,
                      supplier: receipt?.supplier?.name ?? null,
                      sellerTaxCode: receipt?.sellerTaxCode ?? receipt?.supplier?.taxCode ?? null,
                      invoiceSeries: receipt?.invoiceSeries ?? null,
                      invoiceNumber: receipt?.invoiceNumber ?? null,
                      invoiceDate: isoDate(receipt?.invoiceDate),
                      lotPurchaseInvoiceDate: isoDate(c.stockLot.purchaseInvoiceDate),
                      quantity: qty(c.quantity),
                      lotUnitPrice: money(c.lotUnitPrice),
                      invoiceDateWarning: c.invoiceDateWarning
                    };
                  })
                };
              }),
              returnLines: myReturns.map((r) => ({
                receiptId: r.receipt.id,
                receiptNo: r.receipt.receiptNo,
                date: isoDate(r.receipt.date),
                lineId: r.id,
                materialCode: r.material.code,
                materialName: r.material.name,
                unit: r.material.unit,
                quantity: qty(r.quantity),
                unitPrice: money(r.unitPrice),
                amount: money(r.total)
              })),
              directCostLines: costLines
                .filter((c) => c.projectId === project.id)
                .map((c) => ({
                  id: c.id,
                  group: c.group,
                  description: c.description,
                  supplier: c.supplier?.name ?? null,
                  sellerTaxCode: c.sellerTaxCode,
                  invoiceSeries: c.invoiceSeries,
                  invoiceNumber: c.invoiceNumber ?? c.invoiceNo,
                  invoiceDate: isoDate(c.invoiceDate),
                  amount: money(c.amount),
                  vatRate: c.vatRate === null ? null : Number(c.vatRate),
                  vatAmount: c.vatAmount === null ? null : money(c.vatAmount)
                }))
            }
          : {})
      };
    });

    const pageTotals = rows.reduce(
      (acc, r) => ({
        materialCost: acc.materialCost + r.materialCost,
        returnedCost: acc.returnedCost + r.returnedCost,
        netMaterialCost: acc.netMaterialCost + r.netMaterialCost,
        directCost: acc.directCost + r.directCost,
        totalCost: acc.totalCost + r.totalCost
      }),
      { materialCost: 0, returnedCost: 0, netMaterialCost: 0, directCost: 0, totalCost: 0 }
    );

    const masked = maskReport({ data: rows, totals: pageTotals }, costVisible);
    const meta = await buildReportMeta(this.prisma, user, {
      referenceDate: to ?? new Date(),
      period: { from, to },
      filters: { projectId: query.projectId, fromDate: query.fromDate, toDate: query.toDate, includeLines },
      extra: {
        totals: masked.totals,
        totalsScope: "page",
        materialCostBasis:
          "Vật tư = Σ dòng phiếu xuất CONFIRMED có projectId (không tính phiếu đã hủy) theo giá xuất đã ghi, trừ phiếu hoàn kho RETURN_FROM_PROJECT. Chi phí trực tiếp = ProjectCost theo nhóm CostGroup (theo ngày hóa đơn)."
      }
    });
    return { meta, data: masked.data, page: buildPage(query.page, query.limit, total) };
  }
}
