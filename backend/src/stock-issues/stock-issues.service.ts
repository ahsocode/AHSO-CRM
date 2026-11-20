import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IssueReasonType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { JwtUser } from "../auth/auth.types";
import { generateNextStockIssueNo } from "../common/utils/document-number";
import { PrismaService } from "../common/prisma.service";
import { invoiceDayEnd } from "../common/utils/invoice-date";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import {
  assertCanApprove,
  assertPeriodOpen,
  getCostingMethod,
  getManualIssuePriceMode
} from "../inventory/inventory-controls";
import { CancelStockIssueDto } from "./dto/cancel-stock-issue.dto";
import { CreateStockIssueDto } from "./dto/create-stock-issue.dto";
import { StockIssueFilterDto } from "./dto/stock-issue-filter.dto";
import { UpdateStockIssueDto } from "./dto/update-stock-issue.dto";

export interface LotView {
  stockLotId: string;
  quantity: number;
  lotUnitPrice: number;
  invoiceDateWarning: boolean;
}

@Injectable()
export class StockIssuesService {
  private readonly logger = new Logger(StockIssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryBalance: InventoryBalanceService,
    private readonly audit: AuditService
  ) {}

  async findAll(filters: StockIssueFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockIssue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          project: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockIssue.count({ where }),
    ]);

    return {
      items: items.map((i) => ({
        ...i,
        totalAmount: Number(i.totalAmount),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, _user: JwtUser) {
    const issue = await this.prisma.stockIssue.findFirst({
      where: { id, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
            lotConsumptions: {
              include: {
                stockLot: { select: { id: true, purchaseInvoiceNo: true, purchaseInvoiceDate: true, unitPrice: true } },
              },
            },
          },
        },
      },
    });

    if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất");

    return {
      ...issue,
      totalAmount: Number(issue.totalAmount),
      items: issue.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        lotConsumptions: item.lotConsumptions.map((c) => ({
          ...c,
          quantity: Number(c.quantity),
          lotUnitPrice: Number(c.lotUnitPrice),
          stockLot: { ...c.stockLot, unitPrice: Number(c.stockLot.unitPrice) },
        })),
      })),
    };
  }

  async create(dto: CreateStockIssueDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const warnings = await this.checkManualPrices(tx, dto.items);
      const issueNo = await this.generateNextIssueNo(tx);
      const reasonType = this.resolveReasonType(dto);
      const lines = await this.buildDraftLines(tx, dto.items);

      const issue = await tx.stockIssue.create({
        data: {
          issueNo,
          warehouseId: dto.warehouseId,
          projectId: dto.projectId,
          date: dto.date,
          reasonType,
          reason: dto.reason,
          notes: dto.notes,
          totalAmount: this.sumTotals(lines),
          createdById: user.sub,
          items: { create: lines },
        },
        select: { id: true, issueNo: true },
      });
      return { ...issue, warnings };
    });
  }

  async update(id: string, dto: UpdateStockIssueDto, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      // Only DRAFT issues can be edited: a CONFIRMED issue has already moved stock and lots.
      const issue = await tx.stockIssue.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
      });
      if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");

      const warnings = await this.checkManualPrices(tx, dto.items);
      const lines = await this.buildDraftLines(tx, dto.items);

      const updated = await tx.stockIssue.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          projectId: dto.projectId,
          date: dto.date,
          reasonType: this.resolveReasonType(dto),
          reason: dto.reason,
          notes: dto.notes,
          totalAmount: this.sumTotals(lines),
          items: { deleteMany: {}, create: lines },
        },
        select: { id: true, issueNo: true },
      });
      return { ...updated, warnings };
    });
  }

  /**
   * Confirm a DRAFT issue. The unit price is ALWAYS computed here (never taken from the client):
   *  - AVERAGE: Material.costPrice at confirm time (moving average, unchanged by an issue); lots are still
   *    consumed FIFO-wise so the source invoice stays traceable.
   *  - FIFO: weighted price of the consumed lots.
   * Every consumed lot slice is stored in StockIssueLotConsumption (needed to reverse the issue exactly).
   */
  async confirm(id: string, user: JwtUser) {
    assertCanApprove(user);
    const result = await this.prisma.$transaction(async (tx) => {
      const issue = await tx.stockIssue.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
        include: { items: true },
      });
      if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");

      await assertPeriodOpen(tx, issue.date, "phiếu xuất");

      // Claim the DRAFT -> CONFIRMED transition first: a concurrent confirm blocks on this row and then sees count 0.
      const confirmedAt = new Date();
      const claimed = await tx.stockIssue.updateMany({
        where: { id, status: "DRAFT", deletedAt: null },
        data: { status: "CONFIRMED", confirmedAt },
      });
      if (claimed.count !== 1) {
        throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");
      }

      const materialIds = issue.items.map((item) => item.materialId);
      await this.inventoryBalance.lockMaterials(tx, materialIds);
      const method = await getCostingMethod(tx, issue.date);

      // Pass 1: aggregated sufficiency check per material (the same material may appear on several lines).
      const requiredByMaterial = new Map<string, Decimal>();
      for (const item of issue.items) {
        requiredByMaterial.set(
          item.materialId,
          (requiredByMaterial.get(item.materialId) ?? new Decimal(0)).plus(item.quantity)
        );
      }
      for (const [materialId, qty] of requiredByMaterial) {
        await this.inventoryBalance.ensureSufficientStock(tx, issue.warehouseId, materialId, qty);
      }

      const salesInvoiceDate = await this.resolveSalesInvoiceDate(tx, issue);
      const materials = await tx.material.findMany({
        where: { id: { in: [...new Set(materialIds)] } },
        select: { id: true, name: true, costPrice: true },
      });
      const materialById = new Map(materials.map((m) => [m.id, m]));

      const warnings: string[] = [];
      const pricedItems: Array<{ id: string; materialId: string; unitPrice: number; total: number; lots: LotView[] }> = [];
      let totalAmount = new Decimal(0);

      // Pass 2: consume lots, move balance, price the line.
      for (const item of issue.items) {
        const qty = new Decimal(item.quantity);
        const material = materialById.get(item.materialId);
        const materialLabel = material?.name ?? item.materialId;
        const consumed = await this.inventoryBalance.consumeStockLots(
          tx, issue.warehouseId, item.materialId, qty, issue.date, { projectId: issue.projectId ?? null }
        );
        await this.inventoryBalance.adjustBalance(tx, issue.warehouseId, item.materialId, qty.negated());

        const flagged = new Set(
          consumed
            .filter((lot) => this.isAfterSalesInvoice(lot.purchaseInvoiceDate, salesInvoiceDate))
            .map((lot) => lot.lotId)
        );
        if (flagged.size > 0) {
          const message =
            `Vật tư "${materialLabel}": có lô nhập với ngày hóa đơn mua sau ngày hóa đơn bán ` +
            `(${salesInvoiceDate?.toISOString().slice(0, 10)})`;
          if (method === "FIFO") {
            throw new BadRequestException(
              `${message}. Phương pháp FIFO không cho xuất; hãy kiểm tra ngày hóa đơn hoặc chọn lô khác.`
            );
          }
          warnings.push(`${message} (cảnh báo, vẫn cho xuất theo bình quân gia quyền).`);
        }

        let unitPrice: Decimal;
        let total: Decimal;
        if (method === "FIFO") {
          total = consumed
            .reduce((sum, lot) => sum.plus(lot.qty.mul(lot.unitPrice)), new Decimal(0))
            .toDecimalPlaces(0);
          unitPrice = qty.greaterThan(0) ? total.div(qty).toDecimalPlaces(0) : new Decimal(0);
        } else {
          unitPrice = new Decimal(material?.costPrice ?? 0);
          total = qty.mul(unitPrice).toDecimalPlaces(0);
        }
        totalAmount = totalAmount.plus(total);

        const lots: LotView[] = consumed.map((lot) => ({
          stockLotId: lot.lotId,
          quantity: lot.qty.toNumber(),
          lotUnitPrice: lot.unitPrice.toNumber(),
          invoiceDateWarning: flagged.has(lot.lotId),
        }));
        await tx.stockIssueItem.update({
          where: { id: item.id },
          data: {
            unitPrice,
            total,
            lotConsumptions: {
              create: lots.map((lot) => ({
                stockLotId: lot.stockLotId,
                quantity: new Decimal(lot.quantity),
                lotUnitPrice: new Decimal(lot.lotUnitPrice),
                invoiceDateWarning: lot.invoiceDateWarning,
              })),
            },
          },
        });
        pricedItems.push({ id: item.id, materialId: item.materialId, unitPrice: unitPrice.toNumber(), total: total.toNumber(), lots });
      }

      const confirmed = await tx.stockIssue.update({
        where: { id },
        data: { totalAmount },
        select: { id: true, issueNo: true, status: true, confirmedAt: true },
      });
      return { ...confirmed, totalAmount: totalAmount.toNumber(), costingMethod: method, warnings, items: pricedItems };
    });

    await this.recordAudit(user, "confirm", result.id, {
      before: { status: "DRAFT" },
      after: { status: "CONFIRMED", totalAmount: result.totalAmount, costingMethod: result.costingMethod },
      warnings: result.warnings,
    });
    return result;
  }

  /**
   * Cancel an issue.
   *  - DRAFT: simple status change (legacy behaviour, reason optional).
   *  - CONFIRMED: needs inventory.approve and a reason (>= 5 chars). Creates a RETURN_FROM_PROJECT receipt that
   *    puts the quantity back into the EXACT lots at the exact price, restores the balance and recalculates
   *    Material.costPrice. Idempotent: cancelling an already cancelled issue changes nothing.
   */
  async cancel(id: string, dto: CancelStockIssueDto, user: JwtUser) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      // Row lock serialises concurrent cancels of the same issue.
      await tx.$queryRaw`SELECT id FROM "StockIssue" WHERE id = ${id} FOR UPDATE`;
      const issue = await tx.stockIssue.findFirst({
        where: { id, deletedAt: null },
        include: { items: { include: { lotConsumptions: true } } },
      });
      if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất");

      if (issue.status === "CANCELLED") return this.noopCancelResult(tx, issue);

      const reason = dto?.reason?.trim();

      if (issue.status === "DRAFT") {
        const cancelledAt = new Date();
        await tx.stockIssue.updateMany({
          where: { id, status: "DRAFT" },
          data: { status: "CANCELLED", cancelledAt, cancelledById: user.sub, cancelReason: reason ?? null },
        });
        return {
          result: { id, issueNo: issue.issueNo, status: "CANCELLED" as const, cancelledAt, alreadyCancelled: false },
          audit: null,
        };
      }

      // ── CONFIRMED: reversal ──
      assertCanApprove(user);
      if (!reason || reason.length < 5) {
        throw new BadRequestException("Hủy phiếu xuất đã xác nhận phải nhập lý do (tối thiểu 5 ký tự)");
      }
      const guidance = "Hãy lập phiếu hoàn kho (điều chỉnh) ở kỳ hiện tại thay vì hủy phiếu này.";
      try {
        await assertPeriodOpen(tx, issue.date, "phiếu xuất");
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw new BadRequestException(`${error.message}. ${guidance}`);
        }
        throw error;
      }
      if (issue.projectId) {
        const project = await tx.project.findUnique({
          where: { id: issue.projectId },
          select: { costRecognitionStatus: true },
        });
        if (project?.costRecognitionStatus === "DELIVERED") {
          throw new BadRequestException(
            `Dự án của phiếu này đã bàn giao (giá vốn đã ghi nhận), không thể hủy phiếu xuất. ${guidance}`
          );
        }
      }
      for (const item of issue.items) {
        const consumedQty = item.lotConsumptions.reduce((sum, c) => sum.plus(c.quantity), new Decimal(0));
        if (item.lotConsumptions.length === 0 || !consumedQty.equals(item.quantity)) {
          throw new BadRequestException(
            `Phiếu xuất ${issue.issueNo} thiếu dữ liệu lô nhập đã xuất (phiếu lập trước khi có truy vết lô), không thể hủy tự động. ${guidance}`
          );
        }
      }

      const claimed = await tx.stockIssue.updateMany({
        where: { id, status: "CONFIRMED" },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.sub, cancelReason: reason },
      });
      if (claimed.count !== 1) return this.noopCancelResult(tx, issue);

      const materialIds = issue.items.map((item) => item.materialId);
      await this.inventoryBalance.lockMaterials(tx, materialIds);
      const costBefore = await this.readCostPrices(tx, materialIds);

      // 1. Put quantity back into the exact lots (never above receivedQuantity).
      const lotIds = [...new Set(issue.items.flatMap((item) => item.lotConsumptions.map((c) => c.stockLotId)))].sort();
      await tx.$queryRaw`SELECT id FROM "StockLot" WHERE id IN (${Prisma.join(lotIds)}) ORDER BY id FOR UPDATE`;
      const lots = await tx.stockLot.findMany({
        where: { id: { in: lotIds } },
        select: { id: true, receivedQuantity: true, remainingQuantity: true },
      });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      const returnByLot = new Map<string, Decimal>();
      for (const item of issue.items) {
        for (const c of item.lotConsumptions) {
          returnByLot.set(c.stockLotId, (returnByLot.get(c.stockLotId) ?? new Decimal(0)).plus(c.quantity));
        }
      }
      for (const [lotId, qty] of returnByLot) {
        const lot = lotById.get(lotId);
        if (!lot || new Decimal(lot.remainingQuantity).plus(qty).greaterThan(lot.receivedQuantity)) {
          throw new BadRequestException(
            `Lô nhập ${lotId} không thể nhận lại ${qty.toString()} (vượt số lượng đã nhập hoặc lô không còn). ${guidance}`
          );
        }
        await tx.stockLot.updateMany({ where: { id: lotId }, data: { remainingQuantity: { increment: qty } } });
      }

      // 2. Restore balance and recalculate the moving average, line by line.
      // The quantity goes back at the price at which it LEFT the moving-average pool:
      //  - AVERAGE: item.total / qty (= costPrice at issue time).
      //  - FIFO: the issue was priced from lots and never touched costPrice, so the pool is returned at the
      //    current costPrice (neutral) - the exact lot values are restored on the lots themselves.
      const methodOnIssueDate = await getCostingMethod(tx, issue.date);
      for (const item of issue.items) {
        const qty = new Decimal(item.quantity);
        await this.inventoryBalance.adjustBalance(tx, issue.warehouseId, item.materialId, qty);
        const currentCost = (await tx.material.findUnique({ where: { id: item.materialId }, select: { costPrice: true } }))?.costPrice;
        const returnPrice =
          methodOnIssueDate === "FIFO"
            ? new Decimal(currentCost ?? item.unitPrice)
            : qty.greaterThan(0) ? new Decimal(item.total).div(qty) : new Decimal(item.unitPrice);
        await this.inventoryBalance.updateAverageCostPrice(tx, item.materialId, qty, returnPrice);
      }

      // 3. Reversal document (auto-CONFIRMED internally).
      const now = new Date();
      const receiptNo = await this.generateNextReceiptNo(tx);
      const receipt = await tx.stockReceipt.create({
        data: {
          receiptNo,
          warehouseId: issue.warehouseId,
          date: now,
          status: "CONFIRMED",
          confirmedAt: now,
          receiptType: "RETURN_FROM_PROJECT",
          returnedFromIssueId: issue.id,
          notes: `Hoàn kho do hủy phiếu xuất ${issue.issueNo}. Lý do: ${reason}`,
          totalAmount: new Decimal(issue.items.reduce((sum, item) => sum.plus(item.total), new Decimal(0))),
          createdById: user.sub,
          items: {
            create: issue.items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        select: { id: true, receiptNo: true },
      });

      const costAfter = await this.readCostPrices(tx, materialIds);
      const cancelledAt = now;
      return {
        result: {
          id,
          issueNo: issue.issueNo,
          status: "CANCELLED" as const,
          cancelledAt,
          cancelReason: reason,
          returnReceiptId: receipt.id,
          returnReceiptNo: receipt.receiptNo,
          alreadyCancelled: false,
        },
        audit: {
          before: { status: "CONFIRMED", totalAmount: Number(issue.totalAmount), costPrice: costBefore },
          after: {
            status: "CANCELLED",
            reason,
            returnReceiptId: receipt.id,
            returnReceiptNo: receipt.receiptNo,
            costPrice: costAfter,
            lotsRestored: [...returnByLot].map(([lotId, qty]) => ({ lotId, quantity: qty.toNumber() })),
          },
        },
      };
    });

    if (outcome.audit) await this.recordAudit(user, "cancel", id, outcome.audit);
    return outcome.result;
  }

  async remove(id: string, _user: JwtUser) {
    const issue = await this.prisma.stockIssue.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");

    await this.prisma.stockIssue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  private buildWhere(filters: StockIssueFilterDto): Prisma.StockIssueWhereInput {
    const where: Prisma.StockIssueWhereInput = { deletedAt: null };

    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    return where;
  }

  private generateNextIssueNo(tx: Prisma.TransactionClient): Promise<string> {
    return generateNextStockIssueNo(tx);
  }

  private resolveReasonType(dto: { reasonType?: IssueReasonType; projectId?: string }): IssueReasonType {
    const reasonType = dto.reasonType ?? (dto.projectId ? "PROJECT" : "OTHER");
    if (reasonType === "PROJECT" && !dto.projectId) {
      throw new BadRequestException("Xuất cho dự án phải chọn dự án");
    }
    return reasonType;
  }

  /** Manual unit prices are never used: ignore with a warning (IGNORE_WARN) or reject (BLOCK). */
  private async checkManualPrices(
    tx: Prisma.TransactionClient,
    items: Array<{ unitPrice?: number }>
  ): Promise<string[]> {
    if (!items.some((item) => item.unitPrice !== undefined)) return [];
    if ((await getManualIssuePriceMode(tx)) === "BLOCK") {
      throw new BadRequestException(
        "Không được nhập đơn giá xuất bằng tay: giá xuất do hệ thống tự tính khi xác nhận phiếu"
      );
    }
    return ["Đã bỏ qua đơn giá nhập tay: giá xuất do hệ thống tự tính khi xác nhận phiếu"];
  }

  /**
   * Draft lines carry only an estimate (current Material.costPrice) for display; the real price is
   * computed again on confirm.
   */
  private async buildDraftLines(
    tx: Prisma.TransactionClient,
    items: Array<{ materialId: string; quantity: number }>
  ) {
    const materials = await tx.material.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.materialId))] } },
      select: { id: true, costPrice: true },
    });
    const costById = new Map(materials.map((m) => [m.id, new Decimal(m.costPrice)]));
    return items.map((item) => {
      const unitPrice = costById.get(item.materialId) ?? new Decimal(0);
      return {
        materialId: item.materialId,
        quantity: new Decimal(item.quantity),
        unitPrice,
        total: new Decimal(item.quantity).mul(unitPrice).toDecimalPlaces(0),
      };
    });
  }

  private sumTotals(lines: Array<{ total: Decimal }>) {
    return lines.reduce((sum, line) => sum.plus(line.total), new Decimal(0));
  }

  /** Sales invoice date: allocation's date if the issue belongs to an allocation, else the project's; null = no basis. */
  private async resolveSalesInvoiceDate(
    tx: Prisma.TransactionClient,
    issue: { allocationId: string | null; projectId: string | null }
  ): Promise<Date | null> {
    if (issue.allocationId) {
      const allocation = await tx.projectMaterialAllocation.findUnique({
        where: { id: issue.allocationId },
        select: { salesInvoiceDate: true },
      });
      if (allocation?.salesInvoiceDate) return allocation.salesInvoiceDate;
    }
    if (issue.projectId) {
      const project = await tx.project.findUnique({
        where: { id: issue.projectId },
        select: { salesInvoiceDate: true },
      });
      return project?.salesInvoiceDate ?? null;
    }
    return null;
  }

  private isAfterSalesInvoice(purchaseInvoiceDate: Date | null, salesInvoiceDate: Date | null) {
    if (!purchaseInvoiceDate || !salesInvoiceDate) return false;
    return purchaseInvoiceDate.getTime() > invoiceDayEnd(salesInvoiceDate).getTime();
  }

  private async readCostPrices(tx: Prisma.TransactionClient, materialIds: string[]) {
    const rows = await tx.material.findMany({
      where: { id: { in: [...new Set(materialIds)] } },
      select: { id: true, costPrice: true },
    });
    return Object.fromEntries(rows.map((row) => [row.id, Number(row.costPrice)]));
  }

  private async noopCancelResult(
    tx: Prisma.TransactionClient,
    issue: { id: string; issueNo: string; cancelledAt: Date | null; cancelReason: string | null }
  ) {
    const receipt = await tx.stockReceipt.findFirst({
      where: { returnedFromIssueId: issue.id, receiptType: "RETURN_FROM_PROJECT" },
      select: { id: true, receiptNo: true },
    });
    return {
      result: {
        id: issue.id,
        issueNo: issue.issueNo,
        status: "CANCELLED" as const,
        cancelledAt: issue.cancelledAt,
        cancelReason: issue.cancelReason,
        returnReceiptId: receipt?.id ?? null,
        returnReceiptNo: receipt?.receiptNo ?? null,
        alreadyCancelled: true,
      },
      audit: null,
    };
  }

  // Same numbering/lock as StockReceiptsService so reversal receipts share the PN sequence.
  private async generateNextReceiptNo(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stock_receipt_number'))`;
    const prefix = `PN-${new Date().getFullYear()}-`;
    const latest = await tx.stockReceipt.findFirst({
      where: { receiptNo: { startsWith: prefix } },
      orderBy: { receiptNo: "desc" },
      select: { receiptNo: true },
    });
    const seq = latest?.receiptNo.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  /** Audit is written after commit (AuditService uses its own client); a failure must not undo stock movements. */
  private async recordAudit(user: JwtUser, action: string, resourceId: string, changes: Record<string, unknown>) {
    try {
      await this.audit.record({
        userId: user.sub,
        action,
        resource: "stock-issues",
        resourceId,
        changes: { ...changes, meta: { actorType: "USER" } },
      });
    } catch (error) {
      this.logger.error(`Audit stock-issues ${action} ${resourceId} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
