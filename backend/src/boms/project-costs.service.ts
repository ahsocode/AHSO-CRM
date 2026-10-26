import { invoiceDayEnd } from "../common/utils/invoice-date";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import type { CreateProjectCostDto, ProjectCostFilterDto, UpdateProjectCostDto } from "./dto/project-cost.dto";
import { findAccessibleProject, lockProjectFinance } from "./project-access";

const COST_SELECT = {
  id: true,
  projectId: true,
  group: true,
  description: true,
  supplierId: true,
  invoiceNo: true,
  invoiceDate: true,
  amount: true,
  vatRate: true,
  bomLineId: true,
  allocationId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  supplier: { select: { id: true, code: true, name: true } },
  bomLine: { select: { id: true, name: true, bomId: true, bom: { select: { id: true, code: true } } } },
  allocation: { select: { id: true, salesInvoiceNo: true, salesInvoiceDate: true, status: true } },
  createdBy: { select: { id: true, name: true } }
} as const;

type CostRow = Prisma.ProjectCostGetPayload<{ select: typeof COST_SELECT }>;

export function mapProjectCost(cost: CostRow) {
  return {
    id: cost.id,
    projectId: cost.projectId,
    group: cost.group,
    description: cost.description,
    supplierId: cost.supplierId,
    supplier: cost.supplier,
    invoiceNo: cost.invoiceNo,
    invoiceDate: cost.invoiceDate,
    amount: decimalToNumber(cost.amount),
    vatRate: cost.vatRate === null ? null : decimalToNumber(cost.vatRate),
    bomLineId: cost.bomLineId,
    bomLine: cost.bomLine
      ? { id: cost.bomLine.id, name: cost.bomLine.name, bomId: cost.bomLine.bomId, bomCode: cost.bomLine.bom.code }
      : null,
    allocationId: cost.allocationId,
    allocation: cost.allocation,
    notes: cost.notes,
    createdBy: cost.createdBy,
    createdAt: cost.createdAt,
    updatedAt: cost.updatedAt
  };
}

@Injectable()
export class ProjectCostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, filters: ProjectCostFilterDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, projectId, user);
    const rows = await this.prisma.projectCost.findMany({
      where: { projectId, deletedAt: null, ...(filters.group ? { group: filters.group } : {}) },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      select: COST_SELECT
    });
    const items = rows.map(mapProjectCost);
    return { items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
  }

  async create(projectId: string, dto: CreateProjectCostDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, projectId, user);
    await this.validateReferences(projectId, dto.supplierId, dto.bomLineId);

    const created = await this.prisma.projectCost.create({
      data: {
        projectId,
        group: dto.group,
        description: dto.description,
        supplierId: dto.supplierId ?? null,
        invoiceNo: dto.invoiceNo ?? null,
        invoiceDate: dto.invoiceDate,
        amount: Math.round(dto.amount),
        vatRate: dto.vatRate ?? null,
        bomLineId: dto.bomLineId ?? null,
        notes: dto.notes ?? null,
        createdById: user.sub
      },
      select: COST_SELECT
    });
    return mapProjectCost(created);
  }

  async update(id: string, dto: UpdateProjectCostDto, user: JwtUser) {
    const accessible = await this.findAccessibleCost(id, user);
    return this.prisma.$transaction(async (tx) => {
      await lockProjectFinance(tx, accessible.projectId);
      const cost = await tx.projectCost.findFirst({ where: { id, deletedAt: null }, select: COST_SELECT });
      if (!cost) throw new NotFoundException("Không tìm thấy chi phí");
      if (cost.allocation?.status === "CONFIRMED") {
        throw new BadRequestException("Chi phí đã gắn vào đợt phân bổ đã xác nhận, không thể sửa");
      }
      if (dto.supplierId !== undefined || dto.bomLineId !== undefined) {
        await this.validateReferences(cost.projectId, dto.supplierId, dto.bomLineId);
      }
      // R9: a cost attached to a draft allocation must not be dated after that sales invoice
      if (
        dto.invoiceDate &&
        cost.allocation &&
        dto.invoiceDate.getTime() > invoiceDayEnd(cost.allocation.salesInvoiceDate).getTime()
      ) {
        throw new BadRequestException("Ngày hóa đơn chi phí không được sau ngày hóa đơn bán ra của đợt phân bổ");
      }

      const updated = await tx.projectCost.update({
        where: { id },
        data: {
          ...(dto.group !== undefined ? { group: dto.group } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
          ...(dto.invoiceNo !== undefined ? { invoiceNo: dto.invoiceNo } : {}),
          ...(dto.invoiceDate !== undefined ? { invoiceDate: dto.invoiceDate } : {}),
          ...(dto.amount !== undefined ? { amount: Math.round(dto.amount) } : {}),
          ...(dto.vatRate !== undefined ? { vatRate: dto.vatRate } : {}),
          ...(dto.bomLineId !== undefined ? { bomLineId: dto.bomLineId } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {})
        },
        select: COST_SELECT
      });
      return mapProjectCost(updated);
    });
  }

  async remove(id: string, user: JwtUser) {
    const accessible = await this.findAccessibleCost(id, user);
    return this.prisma.$transaction(async (tx) => {
      await lockProjectFinance(tx, accessible.projectId);
      const cost = await tx.projectCost.findFirst({ where: { id, deletedAt: null }, select: COST_SELECT });
      if (!cost) throw new NotFoundException("Không tìm thấy chi phí");
      if (cost.allocation?.status === "CONFIRMED") {
        throw new BadRequestException("Chi phí đã gắn vào đợt phân bổ đã xác nhận, không thể xóa");
      }
      await tx.projectCost.update({
        where: { id },
        data: { deletedAt: new Date(), allocationId: null }
      });
      return { success: true, id };
    });
  }

  private async findAccessibleCost(id: string, user: JwtUser) {
    const cost = await this.prisma.projectCost.findFirst({
      where: { id, deletedAt: null },
      select: COST_SELECT
    });
    if (!cost) throw new NotFoundException("Không tìm thấy chi phí");
    await findAccessibleProject(this.prisma, cost.projectId, user);
    return cost;
  }

  private async validateReferences(projectId: string, supplierId?: string | null, bomLineId?: string | null) {
    if (supplierId) {
      const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null }, select: { id: true } });
      if (!supplier) throw new BadRequestException("Nhà cung cấp không tồn tại");
    }
    if (bomLineId) {
      const line = await this.prisma.bomLine.findFirst({
        where: { id: bomLineId, bom: { projectId, kind: "PROJECT", deletedAt: null } },
        select: { id: true }
      });
      if (!line) throw new BadRequestException("Dòng BOM không thuộc dự án này");
    }
  }
}
