import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthUserCache } from "../auth/auth-user-cache";
import { isAdmin, JwtUser } from "../auth/auth.types";
import { assertCanGrant } from "../auth/privilege-escalation";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../common/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
  }

  async create(dto: CreateUserDto, actor: JwtUser) {
    const [existingUser, role] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          email: dto.email
        },
        select: {
          id: true
        }
      }),
      this.prisma.userRole.findUnique({
        where: {
          id: dto.roleId
        },
        select: {
          id: true,
          name: true,
          permissions: { select: { resource: true, action: true } }
        }
      })
    ]);

    if (existingUser) {
      throw new ConflictException("Email người dùng đã tồn tại");
    }

    if (!role) {
      throw new NotFoundException("Không tìm thấy vai trò được chọn");
    }

    assertCanGrant(actor, { roleName: role.name, permissions: role.permissions });

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        roleId: dto.roleId,
        avatarUrl: dto.avatarUrl,
        isActive: dto.isActive ?? true
      },
      include: {
        role: true
      }
    });

    void this.emailService.sendEmail(user.email, "Tài khoản AHSO CRM của bạn đã sẵn sàng", "welcome", {
      userName: user.name,
      email: user.email,
      roleName: role.name
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name || "STAFF",
      roleId: user.roleId,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  async update(id: string, dto: UpdateUserDto, actor: JwtUser) {
    const user = await this.prisma.user.findUnique({
      where: {
        id
      },
      include: { role: { select: { name: true } } }
    });

    if (!user) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    const changesRole = dto.roleId !== undefined && dto.roleId !== user.roleId;
    const deactivates = dto.isActive === false && user.isActive;
    const targetIsAdmin = user.role?.name === "ADMIN";

    if (user.id === actor.sub && (changesRole || deactivates)) {
      throw new ForbiddenException("Không thể tự thay đổi vai trò hoặc khóa tài khoản của chính mình");
    }

    if (targetIsAdmin && !isAdmin(actor)) {
      throw new ForbiddenException("Chỉ quản trị viên mới được chỉnh sửa tài khoản quản trị");
    }

    let nextRoleName = user.role?.name ?? null;
    if (changesRole && dto.roleId) {
      const role = await this.prisma.userRole.findUnique({
        where: {
          id: dto.roleId
        },
        select: {
          id: true,
          name: true,
          permissions: { select: { resource: true, action: true } }
        }
      });

      if (!role) {
        throw new NotFoundException("Không tìm thấy vai trò được chọn");
      }

      assertCanGrant(actor, { roleName: role.name, permissions: role.permissions });
      nextRoleName = role.name;
    }

    // Never leave the system without an active administrator.
    if (targetIsAdmin && user.isActive && (deactivates || nextRoleName !== "ADMIN")) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { id: { not: user.id }, isActive: true, role: { name: "ADMIN" } }
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException("Phải còn ít nhất một quản trị viên đang hoạt động");
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      },
      include: {
        role: true
      }
    });

    // Role/isActive changes must take effect on the next request, not after
    // the 60s auth cache expires.
    AuthUserCache.invalidate(id);

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
