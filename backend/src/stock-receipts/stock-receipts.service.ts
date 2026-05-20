import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { CreateStockReceiptDto } from "./dto/create-stock-receipt.dto";
import { StockReceiptFilterDto } from "./dto/stock-receipt-filter.dto";
import { UpdateStockReceiptDto } from "./dto/update-stock-receipt.dto";

@Injectable()
export class StockReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryBalance: InventoryBalanceService
  ) {}

  async findAll(filters: StockReceiptFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockReceipt.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        ...r,
        totalAmount: Number(r.totalAmount),
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
    const receipt = await this.prisma.stockReceipt.findFirst({
      where: { id, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập");

    return {
      ...receipt,
      totalAmount: Number(receipt.totalAmount),
      items: receipt.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    };
  }

  async create(dto: CreateStockReceiptDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const receiptNo = await this.generateNextReceiptNo(tx);
      const totalAmount = this.calculateTotalAmount(dto.items);

      const receipt = await tx.stockReceipt.create({
        data: {
          receiptNo,
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          date: dto.date,
          notes: dto.notes,
          totalAmount,
          createdById: user.sub,
          items: {
            create: dto.items.map((item) => ({
              materialId: item.materialId,
              quantity: new Decimal(item.quantity),
              unitPrice: new Decimal(item.unitPrice),
              total: this.calculateLineTotal(item.quantity, item.unitPrice),
            })),
          },
        },
        select: { id: true, receiptNo: true },
      });

      return receipt;
    });
  }

  async update(id: string, dto: UpdateStockReceiptDto, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
      });
      if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

      const totalAmount = this.calculateTotalAmount(dto.items);

      return tx.stockReceipt.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId,
          date: dto.date,
          notes: dto.notes,
          totalAmount,
          items: {
            deleteMany: {},
            create: dto.items.map((item) => ({
              materialId: item.materialId,
              quantity: new Decimal(item.quantity),
              unitPrice: new Decimal(item.unitPrice),
              total: this.calculateLineTotal(item.quantity, item.unitPrice),
            })),
          },
        },
        select: { id: true, receiptNo: true },
      });
    });
  }

  async confirm(id: string, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
        include: { items: true },
      });
      if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

      for (const item of receipt.items) {
        const qty = new Decimal(item.quantity);
        const price = new Decimal(item.unitPrice);
        await this.inventoryBalance.adjustBalance(tx, receipt.warehouseId, item.materialId, qty);
        await this.inventoryBalance.updateAverageCostPrice(tx, item.materialId, qty, price);
      }

      return tx.stockReceipt.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        select: { id: true, receiptNo: true, status: true, confirmedAt: true },
      });
    });
  }

  async cancel(id: string, _user: JwtUser) {
    const receipt = await this.prisma.stockReceipt.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

    return this.prisma.stockReceipt.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, receiptNo: true, status: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const receipt = await this.prisma.stockReceipt.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

    await this.prisma.stockReceipt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  private buildWhere(filters: StockReceiptFilterDto): Prisma.StockReceiptWhereInput {
    const where: Prisma.StockReceiptWhereInput = { deletedAt: null };

    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    return where;
  }

  private async generateNextReceiptNo(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PN-${year}-`;
    const latest = await tx.stockReceipt.findFirst({
      where: { receiptNo: { startsWith: prefix } },
      orderBy: { receiptNo: "desc" },
      select: { receiptNo: true },
    });
    const seq = latest?.receiptNo.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  private calculateLineTotal(quantity: number, unitPrice: number) {
    return new Decimal(quantity).mul(unitPrice).toDecimalPlaces(0);
  }

  private calculateTotalAmount(items: Array<{ quantity: number; unitPrice: number }>) {
    return items.reduce(
      (sum, item) => sum.plus(this.calculateLineTotal(item.quantity, item.unitPrice)),
      new Decimal(0)
    );
  }
}
