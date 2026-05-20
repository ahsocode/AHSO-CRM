import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CreateMaterialDto } from "./dto/create-material.dto";
import { MaterialFilterDto } from "./dto/material-filter.dto";
import { UpdateMaterialDto } from "./dto/update-material.dto";
import { UpsertMaterialSuppliersDto } from "./dto/upsert-material-supplier.dto";

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: MaterialFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true } },
          stockBalances: { select: { quantity: true } },
        },
      }),
      this.prisma.material.count({ where }),
    ]);

    const items = rawItems.map((m) => {
      const totalStock = m.stockBalances.reduce((sum, b) => sum + Number(b.quantity), 0);
      const isLowStock = m.minStock !== null && totalStock < Number(m.minStock);
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        salePrice: Number(m.salePrice),
        costPrice: Number(m.costPrice),
        minStock: m.minStock !== null ? Number(m.minStock) : null,
        categoryId: m.categoryId,
        category: m.category,
        isActive: m.isActive,
        totalStock,
        isLowStock,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    const filteredItems = filters.lowStockOnly ? items.filter((i) => i.isLowStock) : items;

    return {
      items: filteredItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findAllSelect(_user: JwtUser) {
    const items = await this.prisma.material.findMany({
      where: { deletedAt: null, isActive: true },
      take: 300,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, unit: true, salePrice: true },
    });
    return items.map((m) => ({ ...m, salePrice: Number(m.salePrice) }));
  }

  async findOne(id: string, _user: JwtUser) {
    const material = await this.prisma.material.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        suppliers: {
          include: { supplier: { select: { id: true, name: true, code: true } } },
        },
        stockBalances: {
          include: { warehouse: { select: { id: true, name: true } } },
        },
      },
    });

    if (!material) throw new NotFoundException("Không tìm thấy vật tư");

    return {
      ...material,
      salePrice: Number(material.salePrice),
      costPrice: Number(material.costPrice),
      minStock: material.minStock !== null ? Number(material.minStock) : null,
      suppliers: material.suppliers.map((s) => ({
        ...s,
        costPrice: Number(s.costPrice),
      })),
      stockBalances: material.stockBalances.map((b) => ({
        ...b,
        quantity: Number(b.quantity),
      })),
    };
  }

  async create(dto: CreateMaterialDto, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.create({
        data: {
          code: dto.code,
          name: dto.name,
          unit: dto.unit,
          salePrice: dto.salePrice ?? 0,
          costPrice: dto.costPrice ?? 0,
          minStock: dto.minStock,
          categoryId: dto.categoryId,
          description: dto.description,
          isActive: dto.isActive ?? true,
        },
        select: { id: true, code: true, name: true },
      });

      if (dto.suppliers && dto.suppliers.length > 0) {
        await tx.materialSupplier.createMany({
          data: dto.suppliers.map((s) => ({
            materialId: material.id,
            supplierId: s.supplierId,
            supplierCode: s.supplierCode,
            costPrice: s.costPrice ?? 0,
            leadTimeDays: s.leadTimeDays,
            isPreferred: s.isPreferred ?? false,
          })),
        });
      }

      return material;
    });
  }

  async update(id: string, dto: UpdateMaterialDto, _user: JwtUser) {
    const material = await this.prisma.material.findFirst({ where: { id, deletedAt: null } });
    if (!material) throw new NotFoundException("Không tìm thấy vật tư");

    return this.prisma.material.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: { id: true, code: true, name: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const material = await this.prisma.material.findFirst({ where: { id, deletedAt: null } });
    if (!material) throw new NotFoundException("Không tìm thấy vật tư");

    await this.prisma.material.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  async replaceSuppliers(id: string, dto: UpsertMaterialSuppliersDto, _user: JwtUser) {
    const material = await this.prisma.material.findFirst({ where: { id, deletedAt: null } });
    if (!material) throw new NotFoundException("Không tìm thấy vật tư");

    return this.prisma.$transaction(async (tx) => {
      await tx.materialSupplier.deleteMany({ where: { materialId: id } });

      if (dto.length > 0) {
        await tx.materialSupplier.createMany({
          data: dto.map((s) => ({
            materialId: id,
            supplierId: s.supplierId,
            supplierCode: s.supplierCode,
            costPrice: s.costPrice ?? 0,
            leadTimeDays: s.leadTimeDays,
            isPreferred: s.isPreferred ?? false,
          })),
        });
      }

      return { success: true, id, supplierCount: dto.length };
    });
  }

  private buildWhere(filters: MaterialFilterDto): Prisma.MaterialWhereInput {
    const where: Prisma.MaterialWhereInput = { deletedAt: null };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.supplierId) {
      where.suppliers = { some: { supplierId: filters.supplierId } };
    }

    // lowStockOnly filtering is done post-query since it requires computed totalStock

    return where;
  }
}
