import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { lockProjectFinance } from "../boms/project-access";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import { assertCanApprove, assertPeriodOpen, canViewCost } from "../inventory/inventory-controls";
import { assertProjectCostOpen } from "./cost-lock";
import type { CommonAllocationDto, CommonAllocationFilterDto } from "./dto/project-finance.dto";
import { allocateLargestRemainder, dayAfter, isUniqueViolation, pageMeta, paginate, weightShares } from "./project-finance.helpers";

type Db = Prisma.TransactionClient | PrismaService;

export interface AllocationLine {
  projectId: string;
  projectCode: string;
  projectName: string;
  basisValue: number;
  share: number;
  amount: number;
}

export interface AllocationPlan {
  periodFrom: Date;
  periodTo: Date;
  basis: CommonAllocationDto["basis"];
  totalAmount: number;
  issueItemCount: number;
  lines: AllocationLine[];
  /** Sum of line amounts; always equals totalAmount. */
  allocatedTotal: number;
}

const CAN_VIEW_COST_MESSAGE = "Bạn không có quyền xem giá vốn (inventory.view_cost)";

@Injectable()
export class CommonAllocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async allocate(dto: CommonAllocationDto, user: JwtUser) {
    if (!canViewCost(user)) throw new ForbiddenException(CAN_VIEW_COST_MESSAGE);
    if (dto.mode === "PREVIEW") {
      const plan = await this.buildPlan(this.prisma, dto);
      const overlap = await this.findOverlap(this.prisma, dto);
      return {
        mode: "PREVIEW" as const,
        persisted: false,
        ...plan,
        existingAllocation: overlap ? { id: overlap.id, periodFrom: overlap.periodFrom, periodTo: overlap.periodTo } : null,
        warnings: overlap ? ["Kỳ này đã có phân bổ được xác nhận; xác nhận lại sẽ bị từ chối hoặc trả về phân bổ cũ"] : []
      };
    }
    return this.confirm(dto, user);
  }

  private async confirm(dto: CommonAllocationDto, user: JwtUser) {
    assertCanApprove(user);
    await assertPeriodOpen(this.prisma, dto.periodTo, "phân bổ vật tư dùng chung");

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('common_cost_allocation'))`;
        const overlap = await this.findOverlap(tx, dto);
        if (overlap) {
          if (overlap.periodFrom.getTime() === dto.periodFrom.getTime() && overlap.periodTo.getTime() === dto.periodTo.getTime()) {
            return { created: false as const, id: overlap.id };
          }
          throw new ConflictException({
            statusCode: 409,
            message: "Kỳ này giao với một đợt phân bổ vật tư dùng chung đã xác nhận, không thể phân bổ trùng",
            existingAllocationId: overlap.id
          });
        }

        const plan = await this.buildPlan(tx, dto);
        if (plan.totalAmount <= 0) throw new BadRequestException("Không có vật tư dùng chung đã xuất kho cần phân bổ trong kỳ này");

        for (const line of plan.lines) {
          await lockProjectFinance(tx, line.projectId);
          await assertProjectCostOpen(tx, line.projectId);
        }

        const allocation = await tx.commonCostAllocation.create({
          data: {
            periodFrom: dto.periodFrom,
            periodTo: dto.periodTo,
            method: dto.basis,
            totalAmount: plan.totalAmount,
            createdById: user.sub
          },
          select: { id: true }
        });
        const label = `${dto.periodFrom.toISOString().slice(0, 10)} → ${dto.periodTo.toISOString().slice(0, 10)}`;
        for (const line of plan.lines) {
          let projectCostId: string | null = null;
          if (line.amount > 0) {
            const cost = await tx.projectCost.create({
              data: {
                projectId: line.projectId,
                group: "OTHER",
                description: `Phân bổ vật tư dùng chung kỳ ${label}`,
                invoiceDate: dto.periodTo,
                amount: line.amount,
                notes: `Phân bổ vật tư dùng chung ${allocation.id} (cơ sở ${dto.basis})`,
                createdById: user.sub
              },
              select: { id: true }
            });
            projectCostId = cost.id;
          }
          await tx.commonCostAllocationLine.create({
            data: {
              allocationId: allocation.id,
              projectId: line.projectId,
              amount: line.amount,
              basisValue: Math.round(line.basisValue),
              share: line.share,
              projectCostId
            }
          });
        }
        return { created: true as const, id: allocation.id, plan };
      });

      if (outcome.created) {
        await this.audit.record({
          userId: user.sub,
          action: "common-allocation.confirm",
          resource: "common-allocations",
          resourceId: outcome.id,
          changes: {
            periodFrom: dto.periodFrom,
            periodTo: dto.periodTo,
            basis: dto.basis,
            totalAmount: outcome.plan.totalAmount,
            lines: outcome.plan.lines.map((l) => ({ projectId: l.projectId, amount: l.amount, share: l.share }))
          }
        });
      }
      const detail = await this.findOne(outcome.id, user);
      return { mode: "CONFIRM" as const, persisted: true, idempotent: !outcome.created, allocation: detail };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.prisma.commonCostAllocation.findFirst({
          where: { periodFrom: dto.periodFrom, periodTo: dto.periodTo },
          select: { id: true }
        });
        if (existing) {
          return { mode: "CONFIRM" as const, persisted: true, idempotent: true, allocation: await this.findOne(existing.id, user) };
        }
      }
      throw error;
    }
  }

  async findAll(filters: CommonAllocationFilterDto, user: JwtUser) {
    if (!canViewCost(user)) throw new ForbiddenException(CAN_VIEW_COST_MESSAGE);
    const { page, limit, skip } = paginate(filters.page, filters.limit);
    const where: Prisma.CommonCostAllocationWhereInput = {
      ...(filters.dateFrom ? { periodTo: { gte: filters.dateFrom } } : {}),
      ...(filters.dateTo ? { periodFrom: { lte: filters.dateTo } } : {})
    };
    const [rows, total] = await Promise.all([
      this.prisma.commonCostAllocation.findMany({
        where,
        orderBy: { periodFrom: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { lines: true } } }
      }),
      this.prisma.commonCostAllocation.count({ where })
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      method: row.method,
      totalAmount: decimalToNumber(row.totalAmount),
      lineCount: row._count.lines,
      createdById: row.createdById,
      createdAt: row.createdAt
    }));
    return { items, meta: pageMeta(total, page, limit) };
  }

  async findOne(id: string, user: JwtUser) {
    if (!canViewCost(user)) throw new ForbiddenException(CAN_VIEW_COST_MESSAGE);
    const row = await this.prisma.commonCostAllocation.findFirst({ where: { id }, include: { lines: true } });
    if (!row) throw new NotFoundException("Không tìm thấy đợt phân bổ vật tư dùng chung");
    const projects = await this.prisma.project.findMany({
      where: { id: { in: row.lines.map((l) => l.projectId) } },
      select: { id: true, code: true, name: true }
    });
    const byId = new Map(projects.map((p) => [p.id, p]));
    return {
      id: row.id,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      method: row.method,
      totalAmount: decimalToNumber(row.totalAmount),
      createdById: row.createdById,
      createdAt: row.createdAt,
      lines: row.lines.map((l) => ({
        id: l.id,
        projectId: l.projectId,
        projectCode: byId.get(l.projectId)?.code ?? null,
        projectName: byId.get(l.projectId)?.name ?? null,
        amount: decimalToNumber(l.amount),
        basisValue: decimalToNumber(l.basisValue),
        share: decimalToNumber(l.share),
        projectCostId: l.projectCostId
      }))
    };
  }

  /** Any confirmed allocation whose period intersects the requested one. */
  private findOverlap(db: Db, dto: Pick<CommonAllocationDto, "periodFrom" | "periodTo">) {
    return db.commonCostAllocation.findFirst({
      where: { periodFrom: { lte: dto.periodTo }, periodTo: { gte: dto.periodFrom } },
      select: { id: true, periodFrom: true, periodTo: true }
    });
  }

  /** Pure read: computes the total and the per-project split. Never writes. */
  async buildPlan(db: Db, dto: CommonAllocationDto): Promise<AllocationPlan> {
    const upper = dayAfter(dto.periodTo);
    // Only issues without a project: issues tied to a project are already direct cost of that project.
    const items = await db.stockIssueItem.findMany({
      where: {
        material: { accountingClass: "CONSUMABLE_COMMON" },
        issue: { status: "CONFIRMED", deletedAt: null, projectId: null, date: { gte: dto.periodFrom, lt: upper } }
      },
      select: { id: true, total: true }
    });
    const totalAmount = items.reduce((sum, item) => sum + Math.round(decimalToNumber(item.total)), 0);

    const projects = await db.project.findMany({
      where: {
        deletedAt: null,
        costRecognitionStatus: "IN_PROGRESS",
        status: { not: "LOST" },
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: dto.periodTo } }] },
          { OR: [{ completedAt: null }, { completedAt: { gte: dto.periodFrom } }] }
        ]
      },
      select: { id: true, code: true, name: true }
    });
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const basisByProject = await this.basisValues(db, dto, projects.map((p) => p.id), upper);

    const entries = [...basisByProject.entries()]
      .filter(([projectId, value]) => value > 0 && projectById.has(projectId))
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (dto.basis === "MANUAL") {
      const missing = (dto.manualShares ?? []).filter((s) => !projectById.has(s.projectId));
      if (missing.length) {
        throw new BadRequestException("Có dự án trong manualShares không đang thực hiện (IN_PROGRESS) trong kỳ hoặc không tồn tại");
      }
    }

    if (totalAmount === 0 || entries.length === 0) {
      if (totalAmount > 0 && entries.length === 0) {
        throw new BadRequestException("Không có dự án nào có cơ sở phân bổ trong kỳ (doanh thu/giá vốn trực tiếp bằng 0)");
      }
      return { periodFrom: dto.periodFrom, periodTo: dto.periodTo, basis: dto.basis, totalAmount, issueItemCount: items.length, lines: [], allocatedTotal: 0 };
    }

    const weights = entries.map(([, value]) => value);
    const amounts = allocateLargestRemainder(totalAmount, weights);
    const shares = weightShares(weights);
    const lines: AllocationLine[] = entries.map(([projectId, value], index) => {
      const project = projectById.get(projectId);
      return {
        projectId,
        projectCode: project?.code ?? "",
        projectName: project?.name ?? "",
        basisValue: value,
        share: shares[index],
        amount: amounts[index]
      };
    });
    return {
      periodFrom: dto.periodFrom,
      periodTo: dto.periodTo,
      basis: dto.basis,
      totalAmount,
      issueItemCount: items.length,
      lines,
      allocatedTotal: lines.reduce((sum, l) => sum + l.amount, 0)
    };
  }

  private async basisValues(db: Db, dto: CommonAllocationDto, projectIds: string[], upper: Date): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const add = (projectId: string | null, value: number) => {
      if (projectId) result.set(projectId, (result.get(projectId) ?? 0) + value);
    };
    if (dto.basis === "MANUAL") {
      for (const share of dto.manualShares ?? []) add(share.projectId, share.share);
      return result;
    }
    if (projectIds.length === 0) return result;
    if (dto.basis === "REVENUE") {
      const invoices = await db.salesInvoice.findMany({
        where: { projectId: { in: projectIds }, deletedAt: null, status: "ISSUED", date: { gte: dto.periodFrom, lt: upper } },
        select: { projectId: true, amountExVat: true }
      });
      for (const inv of invoices) add(inv.projectId, Math.round(decimalToNumber(inv.amountExVat)));
      return result;
    }
    // DIRECT_COST: confirmed project issues + direct project costs dated in the period
    const issues = await db.stockIssue.findMany({
      where: { projectId: { in: projectIds }, status: "CONFIRMED", deletedAt: null, date: { gte: dto.periodFrom, lt: upper } },
      select: { projectId: true, totalAmount: true }
    });
    for (const issue of issues) add(issue.projectId, Math.round(decimalToNumber(issue.totalAmount)));
    const costs = await db.projectCost.findMany({
      where: { projectId: { in: projectIds }, deletedAt: null, invoiceDate: { gte: dto.periodFrom, lt: upper } },
      select: { projectId: true, amount: true }
    });
    for (const cost of costs) add(cost.projectId, Math.round(decimalToNumber(cost.amount)));
    return result;
  }
}
