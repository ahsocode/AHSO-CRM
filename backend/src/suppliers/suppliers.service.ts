import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Supplier } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SupplierFilterDto } from "./dto/supplier-filter.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

const RECENT_RECEIPTS_LIMIT = 10;
const EXPORT_MAX_ROWS = 5000;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: SupplierFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);
    // Summary ignores the isActive filter so the "Đang hoạt động" card always
    // reflects the whole (search-filtered) book, not just the current page.
    const summaryWhere = this.buildWhere({ ...filters, isActive: undefined });

    const [items, total, activeCount] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          name: true,
          taxCode: true,
          phone: true,
          email: true,
          contactName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.count({ where: { ...summaryWhere, isActive: true } }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary: { activeCount },
      },
    };
  }

  async findAllSelect(_user: JwtUser) {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null, isActive: true },
      take: 200,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
  }

  /**
   * Detail payload consumed by the supplier detail page. Shape is a contract
   * with frontend `SupplierDetail` — keep both in sync (a missing `_count`
   * here previously crashed the page at render time).
   */
  async findOne(id: string, _user: JwtUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      include: {
        materialSuppliers: {
          where: { material: { deletedAt: null } },
          orderBy: [{ isPreferred: "desc" }, { material: { name: "asc" } }],
          include: {
            material: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
        receipts: {
          where: { deletedAt: null },
          orderBy: { date: "desc" },
          take: RECENT_RECEIPTS_LIMIT,
          select: {
            id: true,
            receiptNo: true,
            date: true,
            status: true,
            totalAmount: true,
            purchaseInvoiceNo: true,
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!supplier) throw new NotFoundException("Không tìm thấy nhà cung cấp");

    const [receiptCount, confirmedTotals] = await this.prisma.$transaction([
      this.prisma.stockReceipt.count({ where: { supplierId: id, deletedAt: null } }),
      this.prisma.stockReceipt.aggregate({
        where: { supplierId: id, deletedAt: null, status: "CONFIRMED" },
        _sum: { totalAmount: true },
        _max: { date: true },
      }),
    ]);

    const { materialSuppliers, receipts, ...base } = supplier;

    return {
      ...base,
      _count: {
        materialSuppliers: materialSuppliers.length,
        receipts: receiptCount,
      },
      stats: {
        confirmedPurchaseTotal: decimalToNumber(confirmedTotals._sum.totalAmount),
        lastReceiptDate: confirmedTotals._max.date,
      },
      materials: materialSuppliers.map((link) => ({
        id: link.id,
        materialId: link.material.id,
        materialCode: link.material.code,
        materialName: link.material.name,
        unit: link.material.unit,
        supplierCode: link.supplierCode,
        costPrice: decimalToNumber(link.costPrice),
        leadTimeDays: link.leadTimeDays,
        isPreferred: link.isPreferred,
      })),
      recentReceipts: receipts.map((receipt) => ({
        id: receipt.id,
        receiptNo: receipt.receiptNo,
        date: receipt.date,
        status: receipt.status,
        totalAmount: decimalToNumber(receipt.totalAmount),
        purchaseInvoiceNo: receipt.purchaseInvoiceNo,
        warehouse: receipt.warehouse,
      })),
    };
  }

  async create(dto: CreateSupplierDto, _user: JwtUser) {
    await this.assertCodeAvailable(dto.code);

    return this.prisma.supplier.create({
      data: {
        code: dto.code,
        name: dto.name,
        taxCode: dto.taxCode,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        contactName: dto.contactName,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
      },
      select: { id: true, code: true, name: true },
    });
  }

  async update(id: string, dto: UpdateSupplierDto, _user: JwtUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException("Không tìm thấy nhà cung cấp");

    if (dto.code !== undefined && dto.code !== supplier.code) {
      await this.assertCodeAvailable(dto.code, id);
    }

    // `null` clears an optional field; `undefined` leaves it untouched.
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.taxCode !== undefined && { taxCode: dto.taxCode }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: { id: true, code: true, name: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException("Không tìm thấy nhà cung cấp");

    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  async bulkExport(ids: string[]) {
    const items = await this.prisma.supplier.findMany({
      where: { id: { in: ids }, deletedAt: null },
      orderBy: { name: "asc" },
    });
    return { action: "export", items: items.map((s) => this.toExportRow(s)) };
  }

  /** Full export honoring current filters (list page "Xuất Excel"). */
  async exportAll(filters: SupplierFilterDto) {
    const items = await this.prisma.supplier.findMany({
      where: this.buildWhere(filters),
      orderBy: { name: "asc" },
      take: EXPORT_MAX_ROWS,
    });
    return { items: items.map((s) => this.toExportRow(s)) };
  }

  private toExportRow(s: Supplier) {
    return {
      "Mã NCC": s.code,
      "Tên nhà cung cấp": s.name,
      "Mã số thuế": s.taxCode ?? "",
      "Địa chỉ": s.address ?? "",
      "Điện thoại": s.phone ?? "",
      "Email": s.email ?? "",
      "Người liên hệ": s.contactName ?? "",
      "Ghi chú": s.notes ?? "",
      "Trạng thái": s.isActive ? "Hoạt động" : "Ngưng",
    };
  }

  /**
   * `code` is @unique at DB level and soft-deleted rows still hold it, so a
   * duplicate previously surfaced as a raw Prisma P2002 → generic 500.
   */
  private async assertCodeAvailable(code: string, excludeId?: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, deletedAt: true },
    });
    if (!existing) return;

    throw new ConflictException(
      existing.deletedAt
        ? `Mã NCC "${code}" thuộc một nhà cung cấp đã xóa. Vui lòng dùng mã khác.`
        : `Mã NCC "${code}" đã tồn tại.`
    );
  }

  private buildWhere(filters: Partial<SupplierFilterDto>): Prisma.SupplierWhereInput {
    const where: Prisma.SupplierWhereInput = { deletedAt: null };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
        { taxCode: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return where;
  }
}
