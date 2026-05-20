import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CreateMaterialCategoryDto, UpdateMaterialCategoryDto } from "./dto/create-material-category.dto";

@Injectable()
export class MaterialCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.materialCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { materials: true } },
      },
    });
  }

  async create(dto: CreateMaterialCategoryDto) {
    return this.prisma.materialCategory.create({
      data: {
        code: dto.code,
        name: dto.name,
        parentId: dto.parentId,
      },
      select: { id: true, code: true, name: true },
    });
  }

  async update(id: string, dto: UpdateMaterialCategoryDto) {
    const category = await this.prisma.materialCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException("Không tìm thấy danh mục vật tư");

    return this.prisma.materialCategory.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      select: { id: true, code: true, name: true },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.materialCategory.findUnique({
      where: { id },
      include: { _count: { select: { materials: true } } },
    });
    if (!category) throw new NotFoundException("Không tìm thấy danh mục vật tư");

    if (category._count.materials > 0) {
      throw new BadRequestException(
        `Danh mục đang được sử dụng bởi ${category._count.materials} vật tư, không thể xóa`
      );
    }

    await this.prisma.materialCategory.delete({ where: { id } });

    return { success: true, id };
  }
}
