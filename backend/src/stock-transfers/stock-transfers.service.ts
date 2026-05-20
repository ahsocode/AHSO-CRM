import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { CreateStockTransferDto } from "./dto/create-stock-transfer.dto";
import { StockTransferFilterDto } from "./dto/stock-transfer-filter.dto";
import { UpdateStockTransferDto } from "./dto/update-stock-transfer.dto";

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryBalance: InventoryBalanceService
  ) {}

  async findAll(filters: StockTransferFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, _user: JwtUser) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, deletedAt: null },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!transfer) throw new NotFoundException("Không tìm thấy phiếu chuyển kho");

    return {
      ...transfer,
      items: transfer.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
      })),
    };
  }

  async create(dto: CreateStockTransferDto, user: JwtUser) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Kho xuất và kho nhận không được giống nhau");
    }

    return this.prisma.$transaction(async (tx) => {
      const transferNo = await this.generateNextTransferNo(tx);

      return tx.stockTransfer.create({
        data: {
          transferNo,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          date: dto.date,
          notes: dto.notes,
          createdById: user.sub,
          items: {
            create: dto.items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity,
            })),
          },
        },
        select: { id: true, transferNo: true },
      });
    });
  }

  async update(id: string, dto: UpdateStockTransferDto, _user: JwtUser) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException("Kho xuất và kho nhận không được giống nhau");
    }

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
      });
      if (!transfer) throw new NotFoundException("Không tìm thấy phiếu chuyển kho hoặc phiếu không ở trạng thái nháp");

      return tx.stockTransfer.update({
        where: { id },
        data: {
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          date: dto.date,
          notes: dto.notes,
          items: {
            deleteMany: {},
            create: dto.items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity,
            })),
          },
        },
        select: { id: true, transferNo: true },
      });
    });
  }

  async confirm(id: string, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
        include: { items: true },
      });
      if (!transfer) throw new NotFoundException("Không tìm thấy phiếu chuyển kho hoặc phiếu không ở trạng thái nháp");

      if (transfer.fromWarehouseId === transfer.toWarehouseId) {
        throw new BadRequestException("Kho xuất và kho nhận không được giống nhau");
      }

      // First pass: validate stock for all items
      for (const item of transfer.items) {
        const qty = new Decimal(item.quantity);
        await this.inventoryBalance.ensureSufficientStock(tx, transfer.fromWarehouseId, item.materialId, qty);
      }

      // Second pass: adjust balances
      for (const item of transfer.items) {
        const qty = new Decimal(item.quantity);
        await this.inventoryBalance.adjustBalance(tx, transfer.fromWarehouseId, item.materialId, qty.negated());
        await this.inventoryBalance.adjustBalance(tx, transfer.toWarehouseId, item.materialId, qty);
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        select: { id: true, transferNo: true, status: true, confirmedAt: true },
      });
    });
  }

  async cancel(id: string, _user: JwtUser) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!transfer) throw new NotFoundException("Không tìm thấy phiếu chuyển kho hoặc phiếu không ở trạng thái nháp");

    return this.prisma.stockTransfer.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, transferNo: true, status: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!transfer) throw new NotFoundException("Không tìm thấy phiếu chuyển kho hoặc phiếu không ở trạng thái nháp");

    await this.prisma.stockTransfer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  private buildWhere(filters: StockTransferFilterDto): Prisma.StockTransferWhereInput {
    const where: Prisma.StockTransferWhereInput = { deletedAt: null };

    if (filters.warehouseId) {
      where.OR = [
        { fromWarehouseId: filters.warehouseId },
        { toWarehouseId: filters.warehouseId },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    return where;
  }

  private async generateNextTransferNo(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PCT-${year}-`;
    const latest = await tx.stockTransfer.findFirst({
      where: { transferNo: { startsWith: prefix } },
      orderBy: { transferNo: "desc" },
      select: { transferNo: true },
    });
    const seq = latest?.transferNo.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }
}
