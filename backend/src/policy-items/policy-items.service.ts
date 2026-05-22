import { Injectable, NotFoundException } from "@nestjs/common";
import { PolicyItemType } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import type { CreatePolicyItemDto, UpdatePolicyItemDto } from "./dto/policy-item.dto";

@Injectable()
export class PolicyItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(type?: PolicyItemType) {
    return this.prisma.policyItem.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async create(dto: CreatePolicyItemDto) {
    if (dto.isDefault) {
      await this.prisma.policyItem.updateMany({
        where: { type: dto.type, isDefault: true },
        data: { isDefault: false }
      });
    }
    return this.prisma.policyItem.create({ data: dto });
  }

  async update(id: string, dto: UpdatePolicyItemDto) {
    const item = await this.prisma.policyItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Không tìm thấy policy item");

    if (dto.isDefault) {
      await this.prisma.policyItem.updateMany({
        where: { type: item.type, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }
    return this.prisma.policyItem.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const item = await this.prisma.policyItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Không tìm thấy policy item");
    return this.prisma.policyItem.delete({ where: { id } });
  }
}
