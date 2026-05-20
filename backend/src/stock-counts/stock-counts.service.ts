import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
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

      // Batch-load balances to avoid N+1
      const materialIds = dto.items.map((i) => i.materialId);
      const balances = await tx.stockBalance.findMany({
        where: { warehouseId: dto.warehouseId, materialId: { in: materialIds } },
        select: { materialId: true, quantity: true },
      });
      const balanceMap = new Map(balances.map((b) => [b.materialId, b.quantity]));

      const itemsWithSystem = dto.items.map((item) => {
        const qty = balanceMap.get(item.materialId);
        const systemQuantity = qty !== undefined ? new Decimal(qty) : new Decimal(0);
        const actualQuantity = new Decimal(item.actualQuantity);
        return { materialId: item.materialId, actualQuantity, systemQuantity, diff: actualQuantity.minus(systemQuantity) };
      });

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
        include: { items: { select: { materialId: true, systemQuantity: true } } },
      });
      if (!count) throw new NotFoundException("Không tìm thấy phiếu kiểm kho hoặc phiếu không ở trạng thái nháp");

      // Preserve systemQuantity from when the count was created — re-fetching from balance
      // would silently change it if other receipts/issues ran between create and update.
      const existingSystemMap = new Map(count.items.map((i) => [i.materialId, i.systemQuantity]));

      // For new items added during edit, fetch balance in batch
      const newMaterialIds = dto.items
        .map((i) => i.materialId)
        .filter((mid) => !existingSystemMap.has(mid));

      if (newMaterialIds.length > 0) {
        const newBalances = await tx.stockBalance.findMany({
          where: { warehouseId: dto.warehouseId, materialId: { in: newMaterialIds } },
          select: { materialId: true, quantity: true },
        });
        for (const b of newBalances) existingSystemMap.set(b.materialId, b.quantity);
      }

      const itemsWithSystem = dto.items.map((item) => {
        const sysQty = existingSystemMap.get(item.materialId);
        const systemQuantity = sysQty !== undefined ? new Decimal(sysQty) : new Decimal(0);
        const actualQuantity = new Decimal(item.actualQuantity);
        return { materialId: item.materialId, actualQuantity, systemQuantity, diff: actualQuantity.minus(systemQuantity) };
      });

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
        const diff = new Decimal(item.diff);
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stock_count_number'))`;
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
