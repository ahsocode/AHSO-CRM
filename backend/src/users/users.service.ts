import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: {
        role: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name || "STAFF",
      roleId: user.roleId,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt
    }));
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id
      }
    });

    if (!user) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id
      },
      data: dto,
      include: {
        role: true
      }
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role?.name || "STAFF",
      roleId: updatedUser.roleId,
      avatarUrl: updatedUser.avatarUrl,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };
  }
}

