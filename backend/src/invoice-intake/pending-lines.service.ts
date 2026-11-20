import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { canViewCost, maskCosts } from "../inventory/inventory-controls";
import type {
  DiscardPendingLineDto,
  PendingLineFilterDto,
  ResolvePendingLineDto
} from "./dto/invoice-intake.dto";
import { actorUserId } from "./invoice-intake.utils";
import { MaterialMatchingService } from "./material-matching.service";

const round0 = (value: Decimal) => value.toDecimalPlaces(0);

@Injectable()
export class PendingLinesService {
  private readonly logger = new Logger(PendingLinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MaterialMatchingService,
    private readonly audit: AuditService
  ) {}

  async list(filters: PendingLineFilterDto, user: JwtUser) {
    const where: Prisma.ReceiptPendingLineWhereInput = {
      status: filters.status ?? "PENDING",
      ...(filters.receiptId ? { receiptId: filters.receiptId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      receipt: { deletedAt: null, ...(filters.supplierId ? { supplierId: filters.supplierId } : {}) }
    };
    const skip = (filters.page - 1) * filters.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.receiptPendingLine.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: [{ createdAt: "asc" }, { lineNo: "asc" }],
        include: {
          receipt: {
            select: {
              id: true, receiptNo: true, status: true, supplierId: true, invoiceSeries: true,
              invoiceNumber: true, invoiceDate: true, source: true,
              supplier: { select: { id: true, name: true } }
            }
          }
        }
      }),
      this.prisma.receiptPendingLine.count({ where })
    ]);
    const items = rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
      vatRate: r.vatRate === null ? null : Number(r.vatRate),
      vatAmount: r.vatAmount === null ? null : Number(r.vatAmount)
    }));
    return {
      data: maskCosts(items, canViewCost(user)),
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) }
    };
  }

  /** Creates the real StockReceiptItem on the DRAFT receipt and marks the line RESOLVED. */
  async resolve(id: string, dto: ResolvePendingLineDto, user: JwtUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.receiptPendingLine.findUnique({
        where: { id },
        include: { receipt: { select: { id: true, status: true, deletedAt: true, supplierId: true, receiptType: true } } }
      });
      if (!line || line.receipt.deletedAt) throw new NotFoundException("Không tìm thấy dòng chờ ghép");
      if (line.status !== "PENDING") throw new ConflictException("Dòng này đã được xử lý (đã ghép hoặc đã bỏ)");
      if (line.receipt.status !== "DRAFT" || line.receipt.receiptType !== "PURCHASE") {
        throw new BadRequestException("Chỉ ghép được dòng của phiếu nhập mua đang ở trạng thái nháp");
      }

      const material = await tx.material.findFirst({
        where: { id: dto.materialId, deletedAt: null },
        select: { id: true, kind: true, name: true }
      });
      if (!material) throw new NotFoundException("Không tìm thấy vật tư");
      if (material.kind === "SERVICE") {
        throw new BadRequestException(`Vật tư "${material.name}" là dịch vụ, không nhập kho được`);
      }

      // Conversion: explicit > existing alias > none
      let conversion: Decimal | null = dto.unitConversion !== undefined ? new Decimal(String(dto.unitConversion)) : null;
      if (!conversion && line.receipt.supplierId) {
        const alias = await this.matching.findAlias(tx, line.receipt.supplierId, line.supplierItemCode ?? undefined, line.supplierItemName);
        if (alias && alias.materialId === material.id) conversion = alias.unitConversion;
      }

      const lineQty = new Decimal(line.quantity);
      const linePrice = new Decimal(line.unitPrice);
      const originalTotal = round0(lineQty.mul(linePrice));
      const quantity = conversion ? lineQty.mul(conversion).toDecimalPlaces(3) : lineQty;
      const unitPrice = conversion ? round0(linePrice.div(conversion)) : linePrice;
      const total = round0(quantity.mul(unitPrice));

      // Claim the line atomically so two resolvers cannot both create an item.
      const claimed = await tx.receiptPendingLine.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "RESOLVED", resolvedMaterialId: material.id, resolvedAt: new Date(), resolvedById: user.sub }
      });
      if (claimed.count !== 1) throw new ConflictException("Dòng này vừa được xử lý bởi người khác");

      const item = await tx.stockReceiptItem.create({
        data: {
          receiptId: line.receiptId,
          materialId: material.id,
          quantity,
          unitPrice,
          total,
          vatRate: line.vatRate,
          vatAmount: line.vatAmount,
          sourceLineNo: line.lineNo,
          projectId: line.projectId
        },
        select: { id: true }
      });

      // Conversion rounding moves into roundingDiff (invoice total vs stored lines), prices untouched.
      await tx.stockReceipt.update({
        where: { id: line.receiptId },
        data: {
          totalAmount: { increment: total },
          roundingDiff: { increment: originalTotal.minus(total) }
        }
      });

      if (dto.saveAlias && line.receipt.supplierId) {
        await this.matching.upsertAliasInTx(tx, {
          supplierId: line.receipt.supplierId,
          supplierItemCode: line.supplierItemCode,
          supplierItemName: line.supplierItemName,
          supplierUnit: line.supplierUnit,
          materialId: material.id,
          unitConversion: conversion,
          userId: actorUserId(user)
        });
      }
      const remaining = await tx.receiptPendingLine.count({ where: { receiptId: line.receiptId, status: "PENDING" } });
      return { lineId: id, receiptId: line.receiptId, itemId: item.id, materialId: material.id, quantity: quantity.toNumber(), unitPrice: unitPrice.toNumber(), total: total.toNumber(), aliasSaved: Boolean(dto.saveAlias && line.receipt.supplierId), remainingPendingLines: remaining };
    });
    await this.recordAudit(user, "pending_line.resolve", result.lineId, { receiptId: result.receiptId, materialId: result.materialId, itemId: result.itemId });
    return result;
  }

  async discard(id: string, dto: DiscardPendingLineDto, user: JwtUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.receiptPendingLine.findUnique({
        where: { id },
        include: { receipt: { select: { id: true, status: true, deletedAt: true } } }
      });
      if (!line || line.receipt.deletedAt) throw new NotFoundException("Không tìm thấy dòng chờ ghép");
      if (line.status !== "PENDING") throw new ConflictException("Dòng này đã được xử lý (đã ghép hoặc đã bỏ)");
      if (line.receipt.status !== "DRAFT") throw new BadRequestException("Chỉ bỏ được dòng của phiếu đang ở trạng thái nháp");
      const claimed = await tx.receiptPendingLine.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "DISCARDED", discardReason: dto.reason, resolvedAt: new Date(), resolvedById: user.sub }
      });
      if (claimed.count !== 1) throw new ConflictException("Dòng này vừa được xử lý bởi người khác");
      const remaining = await tx.receiptPendingLine.count({ where: { receiptId: line.receiptId, status: "PENDING" } });
      return { lineId: id, receiptId: line.receiptId, status: "DISCARDED" as const, remainingPendingLines: remaining };
    });
    await this.recordAudit(user, "pending_line.discard", result.lineId, { receiptId: result.receiptId, reason: dto.reason });
    return result;
  }

  private async recordAudit(user: JwtUser, action: string, resourceId: string, changes: unknown) {
    try {
      await this.audit.record({ userId: user.sub, action, resource: "receipt-pending-lines", resourceId, changes });
    } catch (error) {
      this.logger.warn(`Không ghi được audit ${action}: ${(error as Error).message}`);
    }
  }
}
