import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { JwtUser, isStaff } from '../auth/auth.types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ActivityFilterDto } from './dto/activity-filter.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  private buildWhere(filters: ActivityFilterDto, user: JwtUser): Prisma.ActivityWhereInput {
    const where: Prisma.ActivityWhereInput = {
      deletedAt: null,
    };

    // For STAFF users, we need to check customer assignment
    // This is handled in the service methods (findOne, create, update)
    // For list view, ADMIN and MANAGER see all, STAFF sees all they have access to
    // ADMIN and MANAGER can see all activities

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted;
    }

    if (filters.search) {
      where.OR = [{ title: { contains: filters.search, mode: 'insensitive' } }, { content: { contains: filters.search, mode: 'insensitive' } }];
    }

    return where;
  }

  async findAll(filters: ActivityFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters, user);

    const [activities, total] = await this.prisma.$transaction([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      items: activities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, user: JwtUser) {
    const activity = await this.prisma.activity.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Hoạt động không tồn tại');
    }

    // Role-based access check
    if (isStaff(user) && activity.customer?.id) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: activity.customer.id },
      });
      if (!customer || customer.assignedToId !== user.sub) {
        throw new ForbiddenException('Bạn không có quyền truy cập hoạt động này');
      }
    }

    return activity;
  }

  async create(input: CreateActivityDto, user: JwtUser) {
    // Verify customer access if customerId is provided
    if (input.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId, deletedAt: null },
      });

      if (!customer) {
        throw new NotFoundException('Khách hàng không tồn tại');
      }

      // STAFF can only create activities for their assigned customers
      if (isStaff(user) && customer.assignedToId !== user.sub) {
        throw new ForbiddenException('Bạn chỉ có thể tạo hoạt động cho khách hàng được giao cho bạn');
      }
    }

    // Verify project access if projectId is provided
    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId, deletedAt: null },
        include: { customer: true },
      });

      if (!project) {
        throw new NotFoundException('Dự án không tồn tại');
      }

      // STAFF can only create activities for projects of their assigned customers
      if (isStaff(user) && project.customer.assignedToId !== user.sub) {
        throw new ForbiddenException('Bạn chỉ có thể tạo hoạt động cho dự án của khách hàng được giao cho bạn');
      }
    }

    const activity = await this.prisma.activity.create({
      data: {
        type: input.type,
        title: input.title,
        content: input.content,
        customerId: input.customerId,
        projectId: input.projectId,
        attachmentUrl: input.attachmentUrl,
        scheduledAt: input.scheduledAt,
        userId: user.sub,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.notificationsService.createMentionNotifications(input.content, {
      title: `Bạn được nhắc tới trong hoạt động "${activity.title}"`,
      link: `/activities/${activity.id}`
    });

    return activity;
  }

  async update(id: string, input: UpdateActivityDto, user: JwtUser) {
    // First check access
    const activity = await this.findOne(id, user);

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        title: input.title ?? activity.title,
        content: input.content ?? activity.content,
        isCompleted: input.isCompleted ?? activity.isCompleted,
        doneAt: input.isCompleted ? new Date() : activity.doneAt,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : activity.scheduledAt,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.notificationsService.createMentionNotifications(updated.content, {
      title: `Bạn được nhắc tới trong hoạt động "${updated.title}"`,
      link: `/activities/${updated.id}`
    });

    return updated;
  }

  async remove(id: string, user: JwtUser) {
    // First check access
    await this.findOne(id, user);

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { success: true, id: updated.id };
  }
}
