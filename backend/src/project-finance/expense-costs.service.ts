import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { findAccessibleProject, lockProjectFinance } from "../boms/project-access";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import { assertPeriodOpen } from "../inventory/inventory-controls";
import { buildWhere } from "../projects/project-where";
import { assertProjectCostOpen } from "./cost-lock";
import type { AssignCostDto, CreateExpenseCostDto, ExpenseCostFilterDto } from "./dto/project-finance.dto";
import { mapCostCategory, pageMeta, paginate } from "./project-finance.helpers";

const COST_SELECT = {
  id: true,
  projectId: true,
  group: true,
  description: true,
  supplierId: true,
  invoiceNo: true,
  invoiceSeries: true,
  invoiceNumber: true,
  sellerTaxCode: true,
  invoiceDate: true,
  amount: true,
  vatRate: true,
  vatAmount: true,
  allocationId: true,
  notes: true,
  createdById: true,
  createdAt: true,
  project: { select: { id: true, code: true, name: true } },
  supplier: { select: { id: true, code: true, name: true } }
} as const;

type CostRow = Prisma.ProjectCostGetPayload<{ select: typeof COST_SELECT }>;

export function mapExpenseCost(row: CostRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    project: row.project,
    group: row.group,
    description: row.description,
    supplierId: row.supplierId,
    supplier: row.supplier,
    invoiceNo: row.invoiceNo,
    invoiceSeries: row.invoiceSeries,
    invoiceNumber: row.invoiceNumber,
    sellerTaxCode: row.sellerTaxCode,
    invoiceDate: row.invoiceDate,
    amount: decimalToNumber(row.amount),
    vatRate: row.vatRate === null ? null : decimalToNumber(row.vatRate),
    vatAmount: row.vatAmount === null ? null : decimalToNumber(row.vatAmount),
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    unassigned: row.projectId === null
  };
}

@Injectable()
export class ExpenseCostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async create(dto: CreateExpenseCostDto, user: JwtUser) {
    const projectId = dto.projectId ?? null;
    if (projectId) await findAccessibleProject(this.prisma, projectId, user);
    await assertPeriodOpen(this.prisma, dto.invoiceDate, "chi phí dự án");
    if (dto.supplierId) await this.assertSupplier(dto.supplierId);

    const group = mapCostCategory(dto.category);
    const amount = Math.round(dto.amount);
    const vatAmount =
      dto.vatAmount != null ? Math.round(dto.vatAmount) : dto.vatRate != null ? Math.round((amount * dto.vatRate) / 100) : null;
    const invoiceNo =
      dto.invoiceNo ?? (dto.invoiceSeries && dto.invoiceNumber ? `${dto.invoiceSeries}-${dto.invoiceNumber}` : null);

    const created = await this.prisma.$transaction(async (tx) => {
      if (projectId) {
        await lockProjectFinance(tx, projectId);
        await assertProjectCostOpen(tx, projectId);
      }
      return tx.projectCost.create({
        data: {
          projectId,
          group,
          description: dto.description,
          supplierId: dto.supplierId ?? null,
          invoiceNo,
          invoiceSeries: dto.invoiceSeries ?? null,
          invoiceNumber: dto.invoiceNumber ?? null,
          sellerTaxCode: dto.sellerTaxCode ?? null,
          invoiceDate: dto.invoiceDate,
          amount,
          vatRate: dto.vatRate ?? null,
          vatAmount,
          notes: dto.notes ?? null,
          createdById: user.sub
        },
        select: COST_SELECT
      });
    });

    await this.audit.record({
      userId: user.sub,
      action: "project-cost.create",
      resource: "project-costs",
      resourceId: created.id,
      changes: { after: mapExpenseCost(created), category: dto.category }
    });
    return { ...mapExpenseCost(created), categoryMappedFrom: dto.category };
  }

  async findAll(filters: ExpenseCostFilterDto, user: JwtUser) {
    const { page, limit, skip } = paginate(filters.page, filters.limit);
    const visibility: Prisma.ProjectCostWhereInput = isStaff(user)
      ? { OR: [{ project: buildWhere({}, user) }, { projectId: null, createdById: user.sub }] }
      : {};
    const where: Prisma.ProjectCostWhereInput = {
      deletedAt: null,
      AND: [visibility],
      ...(filters.unassignedOnly ? { projectId: null } : filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.group ? { group: mapCostCategory(filters.group) } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            invoiceDate: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {})
            }
          }
        : {})
    };
    const [rows, total] = await Promise.all([
      this.prisma.projectCost.findMany({
        where,
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: COST_SELECT
      }),
      this.prisma.projectCost.count({ where })
    ]);
    return { items: rows.map(mapExpenseCost), meta: pageMeta(total, page, limit) };
  }

  async assign(id: string, dto: AssignCostDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, dto.projectId, user);

    const updated = await this.prisma.$transaction(async (tx) => {
      const cost = await tx.projectCost.findFirst({ where: { id, deletedAt: null }, select: COST_SELECT });
      if (!cost) throw new NotFoundException("Không tìm thấy chi phí");
      if (isStaff(user) && cost.projectId === null && cost.createdById !== user.sub) {
        throw new NotFoundException("Không tìm thấy chi phí");
      }
      if (cost.projectId === dto.projectId) return { cost, before: cost.projectId };
      if (cost.allocationId) {
        throw new BadRequestException("Chi phí đã gắn vào đợt phân bổ vật tư, không thể chuyển dự án");
      }
      const common = await tx.commonCostAllocationLine.findFirst({ where: { projectCostId: id }, select: { id: true } });
      if (common) {
        throw new BadRequestException("Chi phí được sinh từ phân bổ vật tư dùng chung, không thể chuyển dự án");
      }
      await assertPeriodOpen(tx, cost.invoiceDate, "chi phí dự án");
      if (cost.projectId) {
        await lockProjectFinance(tx, cost.projectId);
        await assertProjectCostOpen(tx, cost.projectId);
      }
      await lockProjectFinance(tx, dto.projectId);
      await assertProjectCostOpen(tx, dto.projectId);
      const result = await tx.projectCost.update({
        where: { id },
        data: { projectId: dto.projectId },
        select: COST_SELECT
      });
      return { cost: result, before: cost.projectId };
    });

    await this.audit.record({
      userId: user.sub,
      action: "project-cost.assign",
      resource: "project-costs",
      resourceId: id,
      changes: { before: { projectId: updated.before }, after: { projectId: dto.projectId } }
    });
    return mapExpenseCost(updated.cost);
  }

  private async assertSupplier(supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null }, select: { id: true } });
    if (!supplier) throw new BadRequestException("Nhà cung cấp không tồn tại");
  }
}
