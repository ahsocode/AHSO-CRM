import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/common/prisma.service";
import { CreateRoleInput } from "./dto/create-role.dto";
import { UpdateRoleInput } from "./dto/update-role.dto";

const SYSTEM_ROLES = ["ADMIN", "MANAGER", "STAFF"];

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all roles with their permissions
   */
  async findAll() {
    return this.prisma.userRole.findMany({
      include: {
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get a single role by ID with permissions
   */
  async findById(id: string) {
    const role = await this.prisma.userRole.findUnique({
      where: { id },
      include: {
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Vai trò với ID ${id} không tồn tại`);
    }

    return role;
  }

  /**
   * Get a role by name
   */
  async findByName(name: string) {
    return this.prisma.userRole.findUnique({
      where: { name },
      include: {
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
      },
    });
  }

  /**
   * Create a custom role
   */
  async create(input: CreateRoleInput) {
    // Check if role name already exists
    const existing = await this.prisma.userRole.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      throw new ConflictException(
        `Vai trò "${input.name}" đã tồn tại`
      );
    }

    const role = await this.prisma.userRole.create({
      data: {
        name: input.name,
        description: input.description,
        isSystem: false,
        permissions: input.permissionIds
          ? {
              connect: input.permissionIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
      },
    });

    return role;
  }

  /**
   * Update a role (cannot update system roles)
   */
  async update(id: string, input: UpdateRoleInput) {
    const role = await this.findById(id);

    if (role.isSystem) {
      throw new ForbiddenException(
        `Không thể sửa vai trò hệ thống "${role.name}"`
      );
    }

    if (input.name && input.name !== role.name) {
      const existingRole = await this.prisma.userRole.findUnique({
        where: {
          name: input.name
        }
      });

      if (existingRole && existingRole.id !== id) {
        throw new ConflictException(`Vai trò "${input.name}" đã tồn tại`);
      }
    }

    const updated = await this.prisma.userRole.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissionIds
          ? {
              set: input.permissionIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
        _count: {
          select: {
            users: true
          }
        }
      },
    });

    return updated;
  }

  /**
   * Delete a role (cannot delete system roles, must not have users)
   */
  async delete(id: string) {
    const role = await this.findById(id);

    if (role.isSystem) {
      throw new ForbiddenException(
        `Không thể xóa vai trò hệ thống "${role.name}"`
      );
    }

    const userCount = await this.prisma.user.count({
      where: { roleId: id },
    });

    if (userCount > 0) {
      throw new ForbiddenException(
        `Không thể xóa vai trò đã được gán cho ${userCount} người dùng`
      );
    }

    await this.prisma.userRole.delete({ where: { id } });

    return { message: `Vai trò "${role.name}" đã được xóa` };
  }

  /**
   * Get system role by name
   */
  async getSystemRole(name: "ADMIN" | "MANAGER" | "STAFF") {
    return this.prisma.userRole.findUnique({
      where: { name },
      include: {
        permissions: {
          select: {
            id: true,
            resource: true,
            action: true,
          },
        },
      },
    });
  }

  /**
   * Check if user has a specific permission
   */
  async userHasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    return user.role.permissions.some(
      (p) => p.resource === resource && p.action === action
    );
  }

  /**
   * Check if user has any of the required permissions
   */
  async userHasAnyPermission(
    userId: string,
    requiredPermissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    return requiredPermissions.some((req) =>
      user.role.permissions.some(
        (p) => p.resource === req.resource && p.action === req.action
      )
    );
  }
}
