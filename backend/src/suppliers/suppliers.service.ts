import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SupplierFilterDto } from "./dto/supplier-filter.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: SupplierFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
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

  async findAllSelect(_user: JwtUser) {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null, isActive: true },
      take: 200,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
  }

  async findOne(id: string, _user: JwtUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException("Không tìm thấy nhà cung cấp");
    return supplier;
  }

  async create(dto: CreateSupplierDto, _user: JwtUser) {
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
    return {
      action: "export",
      items: items.map((s) => ({
        "Mã NCC": s.code,
        "Tên nhà cung cấp": s.name,
        "Mã số thuế": s.taxCode ?? "",
        "Địa chỉ": s.address ?? "",
        "Điện thoại": s.phone ?? "",
        "Email": s.email ?? "",
        "Liên hệ": s.contactName ?? "",
        "Ghi chú": s.notes ?? "",
        "Trạng thái": s.isActive ? "Hoạt động" : "Ngưng",
      })),
    };
  }

  private buildWhere(filters: SupplierFilterDto): Prisma.SupplierWhereInput {
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
