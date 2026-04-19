import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
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
      createdAt: user.createdAt
    }));
  }

  async create(dto: CreateUserDto) {
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
          name: true
        }
      })
    ]);

    if (existingUser) {
      throw new ConflictException("Email người dùng đã tồn tại");
    }

    if (!role) {
      throw new NotFoundException("Không tìm thấy vai trò được chọn");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
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
      createdAt: user.createdAt
    };
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
