import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceFilterDto } from "./dto/inventory-balance-filter.dto";

@Injectable()
export class InventoryBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustBalance(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    materialId: string,
    delta: Decimal.Value
  ): Promise<void> {
    const decimalDelta = new Decimal(delta);
    await tx.stockBalance.upsert({
      where: { warehouseId_materialId: { warehouseId, materialId } },
      create: { warehouseId, materialId, quantity: decimalDelta },
      update: { quantity: { increment: decimalDelta } },
    });
  }

  async ensureSufficientStock(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    materialId: string,
    quantity: Decimal.Value
  ): Promise<void> {
    const requiredQuantity = new Decimal(quantity);
    const balance = await tx.stockBalance.findUnique({
      where: { warehouseId_materialId: { warehouseId, materialId } },
    });
    const current = balance ? new Decimal(balance.quantity) : new Decimal(0);
    if (current.lessThan(requiredQuantity)) {
      const mat = await tx.material.findUnique({
        where: { id: materialId },
        select: { name: true },
      });
      throw new BadRequestException(
        `Không đủ tồn kho cho vật tư "${mat?.name ?? materialId}". Tồn kho: ${current.toString()}, yêu cầu: ${requiredQuantity.toString()}`
      );
    }
  }

  async updateAverageCostPrice(
    tx: Prisma.TransactionClient,
    materialId: string,
    newQty: Decimal.Value,
    newUnitPrice: Decimal.Value
  ): Promise<void> {
    const decimalNewQty = new Decimal(newQty);
    const decimalNewUnitPrice = new Decimal(newUnitPrice);
    const material = await tx.material.findUnique({
      where: { id: materialId },
      select: { costPrice: true },
    });
    if (!material) return;

    const currentCost = new Decimal(material.costPrice);
    const balances = await tx.stockBalance.findMany({
      where: { materialId },
      select: { quantity: true },
    });
    // adjustBalance already ran — totalAfter includes newQty, so pre-existing = totalAfter - newQty
    const totalAfter = balances.reduce((sum, b) => sum.plus(b.quantity), new Decimal(0));
    const stockBefore = totalAfter.minus(decimalNewQty);
    const newAvg =
      totalAfter.greaterThan(0)
        ? stockBefore
            .mul(currentCost)
            .plus(decimalNewQty.mul(decimalNewUnitPrice))
            .div(totalAfter)
            .toDecimalPlaces(0)
        : decimalNewUnitPrice;

    await tx.material.update({
      where: { id: materialId },
      data: { costPrice: newAvg },
    });
  }

  async findBalances(filters: InventoryBalanceFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.StockBalanceWhereInput = {};

    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.materialId) where.materialId = filters.materialId;

    const include = {
      warehouse: { select: { id: true, name: true, code: true } },
      material: { select: { id: true, name: true, code: true, unit: true, minStock: true, costPrice: true } },
    } as const;

    type BalanceRow = Prisma.StockBalanceGetPayload<{ include: typeof include }>;

    const mapBalance = (b: BalanceRow) => ({
      id: b.id, warehouseId: b.warehouseId, warehouse: b.warehouse,
      materialId: b.materialId,
      material: {
        ...b.material,
        minStock: b.material.minStock !== null ? Number(b.material.minStock) : null,
        costPrice: Number(b.material.costPrice),
      },
      quantity: Number(b.quantity),
      isLowStock: b.material.minStock !== null ? Number(b.quantity) < Number(b.material.minStock) : false,
      updatedAt: b.updatedAt,
    });

    if (filters.lowStockOnly) {
      const all = await this.prisma.stockBalance.findMany({ where, orderBy: { updatedAt: "desc" }, include });
      const filtered = all.map(mapBalance).filter((i) => i.isLowStock);
      return {
        items: filtered.slice(skip, skip + limit),
        meta: { total: filtered.length, page, limit, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
      };
    }

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.stockBalance.findMany({ where, skip, take: limit, orderBy: { updatedAt: "desc" }, include }),
      this.prisma.stockBalance.count({ where }),
    ]);

    return {
      items: rawItems.map(mapBalance),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getSummary() {
    const [balances, lowStockMaterials, draftReceipts, draftIssues, draftTransfers, draftCounts, warehouseCount] =
      await this.prisma.$transaction([
        this.prisma.stockBalance.findMany({
          include: { material: { select: { costPrice: true } } },
        }),
        this.prisma.material.findMany({
          where: { deletedAt: null, minStock: { not: null } },
          include: { stockBalances: { select: { quantity: true } } },
        }),
        this.prisma.stockReceipt.count({ where: { status: "DRAFT", deletedAt: null } }),
        this.prisma.stockIssue.count({ where: { status: "DRAFT", deletedAt: null } }),
        this.prisma.stockTransfer.count({ where: { status: "DRAFT", deletedAt: null } }),
        this.prisma.stockCount.count({ where: { status: "DRAFT", deletedAt: null } }),
        this.prisma.warehouse.count({ where: { deletedAt: null, isActive: true } }),
      ]);

    const totalValue = balances.reduce(
      (sum, b) => sum + Number(b.quantity) * Number(b.material.costPrice),
      0
    );

    const lowStockCount = lowStockMaterials.filter((m) => {
      const total = m.stockBalances.reduce((s, b) => s + Number(b.quantity), 0);
      return total < Number(m.minStock);
    }).length;

    return {
      totalValue: Math.round(totalValue),
      lowStockCount,
      draftDocsCount: draftReceipts + draftIssues + draftTransfers + draftCounts,
      warehouseCount,
    };
  }
}
