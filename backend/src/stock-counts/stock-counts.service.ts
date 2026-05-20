import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { CreateStockCountDto } from "./dto/create-stock-count.dto";
import { StockCountFilterDto } from "./dto/stock-count-filter.dto";
import { UpdateStockCountDto } from "./dto/update-stock-count.dto";

@Injectable()
export class StockCountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryBalance: InventoryBalanceService
  ) {}

  async findAll(filters: StockCountFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockCount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockCount.count({ where }),
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
    const count = await this.prisma.stockCount.findFirst({
      where: { id, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!count) throw new NotFoundException("Không tìm thấy phiếu kiểm kho");

    return {
      ...count,
      items: count.items.map((item) => ({
        ...item,
        systemQuantity: Number(item.systemQuantity),
        actualQuantity: Number(item.actualQuantity),
        diff: Number(item.diff),
      })),
    };
  }

  async create(dto: CreateStockCountDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const countNo = await this.generateNextCountNo(tx);

      // Build items with systemQuantity and diff
      const itemsWithSystem = await Promise.all(
        dto.items.map(async (item) => {
          const balance = await tx.stockBalance.findUnique({
            where: {
              warehouseId_materialId: {
                warehouseId: dto.warehouseId,
                materialId: item.materialId,
              },
            },
            select: { quantity: true },
          });
          const systemQuantity = balance ? Number(balance.quantity) : 0;
          const diff = item.actualQuantity - systemQuantity;
          return { materialId: item.materialId, actualQuantity: item.actualQuantity, systemQuantity, diff };
        })
      );

      return tx.stockCount.create({
        data: {
          countNo,
          warehouseId: dto.warehouseId,
          date: dto.date,
          notes: dto.notes,
          createdById: user.sub,
          items: {
            create: itemsWithSystem.map((item) => ({
              materialId: item.materialId,
              systemQuantity: item.systemQuantity,
              actualQuantity: item.actualQuantity,
              diff: item.diff,
            })),
          },
        },
        select: { id: true, countNo: true },
      });
    });
  }

  async update(id: string, dto: UpdateStockCountDto, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
      });
      if (!count) throw new NotFoundException("Không tìm thấy phiếu kiểm kho hoặc phiếu không ở trạng thái nháp");

      // Build items with systemQuantity and diff
      const itemsWithSystem = await Promise.all(
        dto.items.map(async (item) => {
          const balance = await tx.stockBalance.findUnique({
            where: {
              warehouseId_materialId: {
                warehouseId: dto.warehouseId,
                materialId: item.materialId,
              },
            },
            select: { quantity: true },
          });
          const systemQuantity = balance ? Number(balance.quantity) : 0;
          const diff = item.actualQuantity - systemQuantity;
          return { materialId: item.materialId, actualQuantity: item.actualQuantity, systemQuantity, diff };
        })
      );

      return tx.stockCount.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          date: dto.date,
          notes: dto.notes,
          items: {
            deleteMany: {},
            create: itemsWithSystem.map((item) => ({
              materialId: item.materialId,
              systemQuantity: item.systemQuantity,
              actualQuantity: item.actualQuantity,
              diff: item.diff,
            })),
          },
        },
        select: { id: true, countNo: true },
      });
    });
  }

  async confirm(id: string, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
        include: { items: true },
      });
      if (!count) throw new NotFoundException("Không tìm thấy phiếu kiểm kho hoặc phiếu không ở trạng thái nháp");

      for (const item of count.items) {
        const diff = Number(item.diff);
        await this.inventoryBalance.adjustBalance(tx, count.warehouseId, item.materialId, diff);
      }

      return tx.stockCount.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        select: { id: true, countNo: true, status: true, confirmedAt: true },
      });
    });
  }

  async cancel(id: string, _user: JwtUser) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!count) throw new NotFoundException("Không tìm thấy phiếu kiểm kho hoặc phiếu không ở trạng thái nháp");

    return this.prisma.stockCount.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, countNo: true, status: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!count) throw new NotFoundException("Không tìm thấy phiếu kiểm kho hoặc phiếu không ở trạng thái nháp");

    await this.prisma.stockCount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  private buildWhere(filters: StockCountFilterDto): Prisma.StockCountWhereInput {
    const where: Prisma.StockCountWhereInput = { deletedAt: null };

    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }

    return where;
  }

  private async generateNextCountNo(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `KK-${year}-`;
    const latest = await tx.stockCount.findFirst({
      where: { countNo: { startsWith: prefix } },
      orderBy: { countNo: "desc" },
      select: { countNo: true },
    });
    const seq = latest?.countNo.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }
}
