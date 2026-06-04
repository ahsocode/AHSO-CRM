import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { generateNextStockIssueNo } from "../common/utils/document-number";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { CreateStockIssueDto } from "./dto/create-stock-issue.dto";
import { StockIssueFilterDto } from "./dto/stock-issue-filter.dto";
import { UpdateStockIssueDto } from "./dto/update-stock-issue.dto";

@Injectable()
export class StockIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryBalance: InventoryBalanceService
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
      })),
    };
  }

  async create(dto: CreateStockIssueDto, user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const issueNo = await this.generateNextIssueNo(tx);
      const totalAmount = this.calculateTotalAmount(dto.items);

      return tx.stockIssue.create({
        data: {
          issueNo,
          warehouseId: dto.warehouseId,
          projectId: dto.projectId,
          date: dto.date,
          reason: dto.reason,
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
        select: { id: true, issueNo: true },
      });
    });
  }

  async update(id: string, dto: UpdateStockIssueDto, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.stockIssue.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
      });
      if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");

      const totalAmount = this.calculateTotalAmount(dto.items);

      return tx.stockIssue.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId,
          projectId: dto.projectId,
          date: dto.date,
          reason: dto.reason,
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
        select: { id: true, issueNo: true },
      });
    });
  }

  async confirm(id: string, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.stockIssue.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
        include: { items: true },
      });
      if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");

      for (const item of issue.items) {
        const qty = new Decimal(item.quantity);
        await this.inventoryBalance.ensureSufficientStock(tx, issue.warehouseId, item.materialId, qty);
      }

      for (const item of issue.items) {
        const qty = new Decimal(item.quantity);
        await this.consumeStockLots(tx, issue.warehouseId, item.materialId, qty, issue.date);
        await this.inventoryBalance.adjustBalance(tx, issue.warehouseId, item.materialId, qty.negated());
      }

      return tx.stockIssue.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        select: { id: true, issueNo: true, status: true, confirmedAt: true },
      });
    });
  }

  async cancel(id: string, _user: JwtUser) {
    const issue = await this.prisma.stockIssue.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!issue) throw new NotFoundException("Không tìm thấy phiếu xuất hoặc phiếu không ở trạng thái nháp");

    return this.prisma.stockIssue.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, issueNo: true, status: true },
    });
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

  private calculateLineTotal(quantity: number, unitPrice: number) {
    return new Decimal(quantity).mul(unitPrice).toDecimalPlaces(0);
  }

  private calculateTotalAmount(items: Array<{ quantity: number; unitPrice: number }>) {
    return items.reduce(
      (sum, item) => sum.plus(this.calculateLineTotal(item.quantity, item.unitPrice)),
      new Decimal(0)
    );
  }

  // Delegates to InventoryBalanceService.consumeStockLots (shared FIFO logic)
  private async consumeStockLots(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    materialId: string,
    quantity: Decimal,
    issueDate: Date
  ) {
    await this.inventoryBalance.consumeStockLots(tx, warehouseId, materialId, quantity, issueDate);
  }
}
