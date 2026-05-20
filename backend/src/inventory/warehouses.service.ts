import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehouseFilterDto } from "./dto/inventory-balance-filter.dto";

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: WarehouseFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          manager: { select: { id: true, name: true } },
          _count: { select: { stockBalances: true } },
        },
      }),
      this.prisma.warehouse.count({ where }),
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
    return this.prisma.warehouse.findMany({
      where: { deletedAt: null, isActive: true },
      take: 200,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    });
  }

  async findOne(id: string, _user: JwtUser) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, deletedAt: null },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        stockBalances: {
          orderBy: { quantity: "desc" },
          take: 10,
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });

    if (!warehouse) throw new NotFoundException("Không tìm thấy kho");

    return {
      ...warehouse,
      stockBalances: warehouse.stockBalances.map((b) => ({
        ...b,
        quantity: Number(b.quantity),
      })),
    };
  }

  async create(dto: CreateWarehouseDto, _user: JwtUser) {
    return this.prisma.warehouse.create({
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address,
        managerId: dto.managerId,
        isActive: dto.isActive ?? true,
      },
      select: { id: true, code: true, name: true },
    });
  }

  async update(id: string, dto: UpdateWarehouseDto, _user: JwtUser) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, deletedAt: null } });
    if (!warehouse) throw new NotFoundException("Không tìm thấy kho");

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: { id: true, code: true, name: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, deletedAt: null } });
    if (!warehouse) throw new NotFoundException("Không tìm thấy kho");

    await this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  private buildWhere(filters: WarehouseFilterDto): Prisma.WarehouseWhereInput {
    const where: Prisma.WarehouseWhereInput = { deletedAt: null };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return where;
  }
}
