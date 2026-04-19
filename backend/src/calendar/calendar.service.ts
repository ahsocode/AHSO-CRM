import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { JwtUser, isStaff } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CalendarFilterDto } from "./dto/calendar-filter.dto";

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async findEvents(filters: CalendarFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { start, end } = this.resolveDateRange(filters.dateFrom, filters.dateTo);
    const where = this.buildWhere({ ...filters, dateFrom: start, dateTo: end }, user);
    const now = new Date();
    const todayStart = this.getDayStart(now);
    const todayEnd = this.getDayEnd(now);

    const matchingActivities = await this.prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: {
              select: {
                name: true
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true
          }
        }
      }
    });

    const sortedActivities = matchingActivities
      .map((activity) => ({
        ...activity,
        anchorAt: activity.scheduledAt ?? activity.doneAt ?? activity.updatedAt
      }))
      .sort((left, right) => left.anchorAt.getTime() - right.anchorAt.getTime());

    const total = sortedActivities.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagedActivities = sortedActivities.slice((page - 1) * limit, page * limit);

    return {
      items: pagedActivities.map((activity) => ({
        id: activity.id,
        title: activity.title,
        content: activity.content,
        type: activity.type,
        scheduledAt: activity.scheduledAt,
        doneAt: activity.doneAt,
        isCompleted: activity.isCompleted,
        updatedAt: activity.updatedAt,
        anchorAt: activity.anchorAt,
        user: activity.user,
        customer: activity.customer
          ? {
              id: activity.customer.id,
              name: activity.customer.name,
              status: activity.customer.status
            }
          : null,
        project: activity.project
          ? {
              id: activity.project.id,
              code: activity.project.code,
              name: activity.project.name,
              status: activity.project.status
            }
          : null
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        summary: {
          total,
          openCount: sortedActivities.filter((activity) => !activity.isCompleted).length,
          completedCount: sortedActivities.filter((activity) => activity.isCompleted).length,
          overdueCount: sortedActivities.filter(
            (activity) =>
              !activity.isCompleted && Boolean(activity.scheduledAt && activity.scheduledAt < now)
          ).length,
          todayCount: sortedActivities.filter(
            (activity) =>
              Boolean(
                activity.scheduledAt &&
                  activity.scheduledAt >= todayStart &&
                  activity.scheduledAt <= todayEnd
              )
          ).length
        }
      }
    };
  }

  private buildWhere(
    filters: Partial<CalendarFilterDto> & { dateFrom?: Date; dateTo?: Date },
    user: JwtUser
  ): Prisma.ActivityWhereInput {
    const conditions: Prisma.ActivityWhereInput[] = [
      { deletedAt: null } // Soft delete filter
    ];

    if (isStaff(user)) {
      conditions.push({
        OR: [
          { userId: user.sub },
          {
            customer: {
              assignedToId: user.sub,
              deletedAt: null
            }
          },
          {
            project: {
              deletedAt: null,
              customer: {
                assignedToId: user.sub,
                deletedAt: null
              }
            }
          }
        ]
      });
    }

    if (filters.assigneeId && !isStaff(user)) {
      conditions.push({
        userId: filters.assigneeId
      });
    }

    if (filters.customerId) {
      conditions.push({
        customerId: filters.customerId
      });
    }

    if (filters.projectId) {
      conditions.push({
        projectId: filters.projectId
      });
    }

    if (typeof filters.isCompleted === "boolean") {
      conditions.push({
        isCompleted: filters.isCompleted
      });
    }

    if (filters.type) {
      conditions.push({
        type: filters.type
      });
    }

    if (filters.search) {
      conditions.push({
        OR: [
          {
            title: {
              contains: filters.search,
              mode: "insensitive"
            }
          },
          {
            content: {
              contains: filters.search,
              mode: "insensitive"
            }
          },
          {
            user: {
              name: {
                contains: filters.search,
                mode: "insensitive"
              }
            }
          },
          {
            customer: {
              name: {
                contains: filters.search,
                mode: "insensitive"
              }
            }
          },
          {
            project: {
              name: {
                contains: filters.search,
                mode: "insensitive"
              }
            }
          },
          {
            project: {
              code: {
                contains: filters.search,
                mode: "insensitive"
              }
            }
          }
        ]
      });
    }

    if (filters.dateFrom && filters.dateTo) {
      conditions.push({
        OR: [
          {
            scheduledAt: {
              gte: filters.dateFrom,
              lte: filters.dateTo
            }
          },
          {
            doneAt: {
              gte: filters.dateFrom,
              lte: filters.dateTo
            }
          }
        ]
      });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private resolveDateRange(dateFrom?: Date, dateTo?: Date) {
    const now = new Date();
    const fallbackStart = this.getWeekStart(now);
    const fallbackEnd = this.getWeekEnd(now);

    return {
      start: dateFrom ? this.getDayStart(dateFrom) : fallbackStart,
      end: dateTo ? this.getDayEnd(dateTo) : fallbackEnd
    };
  }

  private getDayStart(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private getDayEnd(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  private getWeekStart(date: Date) {
    const dayIndex = (date.getDay() + 6) % 7;
    return this.getDayStart(new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayIndex));
  }

  private getWeekEnd(date: Date) {
    const start = this.getWeekStart(date);
    return this.getDayEnd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
  }
}
