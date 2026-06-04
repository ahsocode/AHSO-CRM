import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber, sumDecimal, toDecimal } from "../common/utils/decimal";
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

    const mapBalance = (b: BalanceRow) => {
      const quantity = toDecimal(b.quantity);
      const costPrice = toDecimal(b.material.costPrice);

      return {
        id: b.id,
        warehouseId: b.warehouseId,
        warehouse: b.warehouse,
        materialId: b.materialId,
        material: {
          ...b.material,
          minStock: b.material.minStock !== null ? decimalToNumber(b.material.minStock) : null,
          costPrice: decimalToNumber(b.material.costPrice),
        },
        quantity: decimalToNumber(quantity),
        value: decimalToNumber(quantity.mul(costPrice).toDecimalPlaces(0)),
        isLowStock: b.material.minStock !== null ? quantity.lessThan(b.material.minStock) : false,
        updatedAt: b.updatedAt,
      };
    };

    if (filters.lowStockOnly) {
      const filterSql = Prisma.sql`
        WHERE m."minStock" IS NOT NULL
          AND sb."quantity" < m."minStock"
          ${filters.warehouseId ? Prisma.sql`AND sb."warehouseId" = ${filters.warehouseId}` : Prisma.empty}
          ${filters.materialId ? Prisma.sql`AND sb."materialId" = ${filters.materialId}` : Prisma.empty}
      `;
      type LowStockRow = {
        id: string;
        warehouseId: string;
        materialId: string;
        quantity: Decimal;
        updatedAt: Date;
        warehouseCode: string;
        warehouseName: string;
        materialCode: string;
        materialName: string;
        materialUnit: string;
        minStock: Decimal;
        costPrice: Decimal;
      };
      const [rows, countRows] = await this.prisma.$transaction([
        this.prisma.$queryRaw<LowStockRow[]>`
          SELECT
            sb.id,
            sb."warehouseId",
            sb."materialId",
            sb."quantity",
            sb."updatedAt",
            w.code AS "warehouseCode",
            w.name AS "warehouseName",
            m.code AS "materialCode",
            m.name AS "materialName",
            m.unit AS "materialUnit",
            m."minStock",
            m."costPrice"
          FROM "StockBalance" sb
          JOIN "Material" m ON m.id = sb."materialId"
          JOIN "Warehouse" w ON w.id = sb."warehouseId"
          ${filterSql}
          ORDER BY sb."updatedAt" DESC
          OFFSET ${skip}
          LIMIT ${limit}
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "StockBalance" sb
          JOIN "Material" m ON m.id = sb."materialId"
          JOIN "Warehouse" w ON w.id = sb."warehouseId"
          ${filterSql}
        `
      ]);
      const total = Number(countRows[0]?.count ?? 0);
      return {
        items: rows.map((row) => ({
          id: row.id,
          warehouseId: row.warehouseId,
          warehouse: { id: row.warehouseId, name: row.warehouseName, code: row.warehouseCode },
          materialId: row.materialId,
          material: {
            id: row.materialId,
            name: row.materialName,
            code: row.materialCode,
            unit: row.materialUnit,
            minStock: decimalToNumber(row.minStock),
            costPrice: decimalToNumber(row.costPrice),
          },
          quantity: decimalToNumber(row.quantity),
          value: decimalToNumber(toDecimal(row.quantity).mul(row.costPrice).toDecimalPlaces(0)),
          isLowStock: true,
          updatedAt: row.updatedAt,
        })),
        meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
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
      (sum, b) => sum.plus(toDecimal(b.quantity).mul(b.material.costPrice)),
      new Decimal(0)
    );

    const lowStockCount = lowStockMaterials.filter((m) => {
      const total = sumDecimal(m.stockBalances.map((balance) => balance.quantity));
      return total.lessThan(m.minStock ?? 0);
    }).length;

    return {
      totalValue: decimalToNumber(totalValue.toDecimalPlaces(0)),
      lowStockCount,
      draftDocsCount: draftReceipts + draftIssues + draftTransfers + draftCounts,
      warehouseCount,
    };
  }
}
