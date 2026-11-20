import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { findAccessibleProject, lockProjectFinance } from "../boms/project-access";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import { assertPeriodOpen } from "../inventory/inventory-controls";
import { buildWhere } from "../projects/project-where";
import type { CancelSalesInvoiceDto, CreateSalesInvoiceDto, SalesInvoiceFilterDto } from "./dto/project-finance.dto";
import { isUniqueViolation, pageMeta, paginate } from "./project-finance.helpers";

const INVOICE_SELECT = {
  id: true,
  projectId: true,
  contractId: true,
  series: true,
  number: true,
  date: true,
  buyerTaxCode: true,
  amountExVat: true,
  vatAmount: true,
  status: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, code: true, name: true } },
  contract: { select: { id: true, contractNo: true } }
} as const;

type InvoiceRow = Prisma.SalesInvoiceGetPayload<{ select: typeof INVOICE_SELECT }>;

export function mapSalesInvoice(row: InvoiceRow) {
  const amountExVat = decimalToNumber(row.amountExVat);
  const vatAmount = decimalToNumber(row.vatAmount);
  return {
    id: row.id,
    projectId: row.projectId,
    project: row.project,
    contractId: row.contractId,
    contract: row.contract,
    series: row.series,
    number: row.number,
    date: row.date,
    buyerTaxCode: row.buyerTaxCode,
    amountExVat,
    vatAmount,
    totalAmount: amountExVat + vatAmount,
    status: row.status,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

@Injectable()
export class SalesInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async create(dto: CreateSalesInvoiceDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, dto.projectId, user);
    await assertPeriodOpen(this.prisma, dto.date, "hóa đơn bán ra");

    if (dto.contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: dto.contractId, projectId: dto.projectId },
        select: { id: true }
      });
      if (!contract) throw new BadRequestException("Hợp đồng không thuộc dự án này");
    }

    const series = dto.series.trim().toUpperCase();
    const number = dto.number.trim();
    await this.assertNotDuplicate(series, number);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await lockProjectFinance(tx, dto.projectId);
        return tx.salesInvoice.create({
          data: {
            projectId: dto.projectId,
            contractId: dto.contractId ?? null,
            series,
            number,
            date: dto.date,
            buyerTaxCode: dto.buyerTaxCode ?? null,
            amountExVat: Math.round(dto.amountExVat),
            vatAmount: Math.round(dto.vatAmount ?? 0),
            notes: dto.notes ?? null,
            createdById: user.sub
          },
          select: INVOICE_SELECT
        });
      });
      await this.audit.record({
        userId: user.sub,
        action: "sales-invoice.create",
        resource: "sales-invoices",
        resourceId: created.id,
        changes: { after: mapSalesInvoice(created) }
      });
      return mapSalesInvoice(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw await this.duplicateError(series, number);
      }
      throw error;
    }
  }

  async findAll(filters: SalesInvoiceFilterDto, user: JwtUser) {
    const { page, limit, skip } = paginate(filters.page, filters.limit);
    const where: Prisma.SalesInvoiceWhereInput = {
      deletedAt: null,
      project: buildWhere({}, user),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.contractId ? { contractId: filters.contractId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.series ? { series: { contains: filters.series, mode: "insensitive" } } : {}),
      ...(filters.number ? { number: { contains: filters.number, mode: "insensitive" } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? { date: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
        : {})
    };
    const [rows, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        select: INVOICE_SELECT
      }),
      this.prisma.salesInvoice.count({ where })
    ]);
    return { items: rows.map(mapSalesInvoice), meta: pageMeta(total, page, limit) };
  }

  async findOne(id: string, user: JwtUser) {
    const row = await this.prisma.salesInvoice.findFirst({
      where: { id, deletedAt: null, project: buildWhere({}, user) },
      select: INVOICE_SELECT
    });
    if (!row) throw new NotFoundException("Không tìm thấy hóa đơn bán ra");
    return mapSalesInvoice(row);
  }

  async cancel(id: string, dto: CancelSalesInvoiceDto, user: JwtUser) {
    const current = await this.prisma.salesInvoice.findFirst({
      where: { id, deletedAt: null, project: buildWhere({}, user) },
      select: INVOICE_SELECT
    });
    if (!current) throw new NotFoundException("Không tìm thấy hóa đơn bán ra");
    if (current.status !== "ISSUED") {
      throw new BadRequestException("Hóa đơn đã bị hủy hoặc đã được thay thế trước đó");
    }
    await assertPeriodOpen(this.prisma, current.date, "hóa đơn bán ra");

    let replacement: { id: string; series: string; number: string } | null = null;
    if (dto.replacedByInvoiceId) {
      if (dto.replacedByInvoiceId === id) throw new BadRequestException("Hóa đơn thay thế phải khác hóa đơn bị hủy");
      replacement = await this.prisma.salesInvoice.findFirst({
        where: { id: dto.replacedByInvoiceId, deletedAt: null, status: { not: "CANCELLED" } },
        select: { id: true, series: true, number: true }
      });
      if (!replacement) throw new BadRequestException("Không tìm thấy hóa đơn thay thế hợp lệ (chưa hủy)");
    }

    const note = replacement
      ? `Thay thế bởi hóa đơn ${replacement.series}-${replacement.number} (id ${replacement.id}). Lý do: ${dto.reason}`
      : `Đã hủy. Lý do: ${dto.reason}`;

    const updated = await this.prisma.$transaction(async (tx) => {
      await lockProjectFinance(tx, current.projectId);
      const project = await tx.project.findFirst({
        where: { id: current.projectId },
        select: { costRecognitionStatus: true }
      });
      if (project?.costRecognitionStatus === "DELIVERED") {
        const others = await tx.salesInvoice.count({
          where: { projectId: current.projectId, deletedAt: null, status: "ISSUED", id: { not: id } }
        });
        if (others === 0) {
          throw new BadRequestException(
            "Dự án đã DELIVERED và đây là hóa đơn bán ra cuối cùng; hãy mở lại ghi nhận giá vốn (REOPEN) hoặc phát hành hóa đơn thay thế trước khi hủy"
          );
        }
      }
      // Conditional update keeps the cancel idempotent under concurrency.
      const result = await tx.salesInvoice.updateMany({
        where: { id, status: "ISSUED" },
        data: { status: replacement ? "REPLACED" : "CANCELLED", notes: current.notes ? `${current.notes}\n${note}` : note }
      });
      if (result.count === 0) throw new BadRequestException("Hóa đơn đã bị hủy hoặc đã được thay thế trước đó");
      return tx.salesInvoice.findFirstOrThrow({ where: { id }, select: INVOICE_SELECT });
    });

    await this.audit.record({
      userId: user.sub,
      action: replacement ? "sales-invoice.replace" : "sales-invoice.cancel",
      resource: "sales-invoices",
      resourceId: id,
      changes: { before: mapSalesInvoice(current), after: mapSalesInvoice(updated), reason: dto.reason, replacedByInvoiceId: replacement?.id ?? null }
    });
    return mapSalesInvoice(updated);
  }

  private async assertNotDuplicate(series: string, number: string) {
    const existing = await this.prisma.salesInvoice.findFirst({
      where: { series, number, status: { not: "CANCELLED" }, deletedAt: null },
      select: { id: true }
    });
    if (existing) throw await this.duplicateError(series, number);
  }

  private async duplicateError(series: string, number: string) {
    const existing = await this.prisma.salesInvoice.findFirst({
      where: { series, number, status: { not: "CANCELLED" } },
      select: { id: true, projectId: true }
    });
    return new ConflictException({
      statusCode: 409,
      message: `Hóa đơn bán ra ${series}-${number} đã tồn tại và chưa bị hủy`,
      existingInvoiceId: existing?.id ?? null,
      existingProjectId: existing?.projectId ?? null
    });
  }
}
