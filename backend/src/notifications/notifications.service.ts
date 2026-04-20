import { Inject, Injectable, forwardRef } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { DomainEventEnvelope, DomainEventName } from "../domain-events/domain-events.types";
import { NotificationFilterDto } from "./dto/notification-filter.dto";

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => DomainEventsService))
    private readonly domainEvents: DomainEventsService
  ) {}

  async list(filters: NotificationFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      userId: user.sub,
      ...(filters.isRead !== undefined ? { isRead: filters.isRead } : {}),
      ...(filters.type ? { type: filters.type } : {})
    };

    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isRead: "asc" }, { createdAt: "desc" }]
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          userId: user.sub,
          isRead: false
        }
      })
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        unreadCount
      }
    };
  }

  async getUnreadCount(user: JwtUser) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId: user.sub,
        isRead: false
      }
    });

    return { unreadCount };
  }

  async markRead(id: string, user: JwtUser) {
    const notification = await this.prisma.notification.updateMany({
      where: {
        id,
        userId: user.sub
      },
      data: {
        isRead: true
      }
    });

    return {
      success: notification.count > 0
    };
  }

  async markReadAll(user: JwtUser) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        userId: user.sub,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return {
      success: true,
      updatedCount: updated.count
    };
  }

  async createMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) {
      return [];
    }

    const created = await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.notification.create({
          data: {
            userId: input.userId,
            title: input.title,
            message: input.message,
            type: input.type,
            link: input.link ?? null
          }
        })
      )
    );

    return created;
  }

  async handleDomainEvent(envelope: DomainEventEnvelope) {
    const notifications = await this.mapDomainEventToNotifications(envelope.event, envelope.payload);
    const dedupedNotifications = await this.dedupeNotifications(envelope.event, notifications);
    return this.createMany(dedupedNotifications);
  }

  async createMentionNotifications(content: string | null | undefined, context: { link?: string | null; title: string }) {
    if (!content) {
      return [];
    }

    const emails = Array.from(
      new Set(
        [...content.matchAll(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)]
          .map((match) => match[1]?.toLowerCase())
          .filter((value): value is string => Boolean(value))
      )
    );

    if (emails.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        email: {
          in: emails
        },
        isActive: true
      },
      select: {
        id: true,
        email: true
      }
    });

    return Promise.all(
      users.map((user) =>
        this.domainEvents.emit("mention.created", {
          userId: user.id,
          email: user.email,
          title: context.title,
          link: context.link ?? null
        })
      )
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async createDueNotifications() {
    const now = new Date();
    const nextThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [dueMilestones, overduePayments] = await this.prisma.$transaction([
      this.prisma.milestone.findMany({
        where: {
          dueDate: {
            gte: now,
            lte: nextThreeDays
          },
          status: {
            in: ["PENDING", "IN_PROGRESS"]
          }
        },
        select: {
          id: true,
          name: true,
          dueDate: true,
          project: {
            select: {
              id: true,
              name: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  assignedToId: true
                }
              }
            }
          }
        }
      }),
      this.prisma.milestone.findMany({
        where: {
          paymentAmount: {
            not: null
          },
          dueDate: {
            lt: now
          },
          status: {
            notIn: ["DONE", "ACCEPTED"]
          }
        },
        select: {
          id: true,
          name: true,
          dueDate: true,
          paymentAmount: true,
          project: {
            select: {
              id: true,
              name: true,
              customer: {
                select: {
                  id: true,
                  name: true,
                  assignedToId: true
                }
              }
            }
          }
        }
      })
    ]);

    for (const milestone of dueMilestones) {
      const notification = {
        userId: milestone.project.customer.assignedToId,
        title: "Milestone sắp đến hạn",
        message: `${milestone.name} cần theo dõi trước ${milestone.dueDate?.toLocaleDateString("vi-VN") ?? "hạn chưa xác định"}.`,
        type: "warning",
        link: `/projects/${milestone.project.id}`
      };

      if (await this.hasMatchingNotificationToday(notification)) {
        continue;
      }

      await this.domainEvents.emit("milestone.due_soon", {
        userId: milestone.project.customer.assignedToId,
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        dueDate: milestone.dueDate?.toISOString() ?? null,
        projectId: milestone.project.id,
        projectName: milestone.project.name,
        customerId: milestone.project.customer.id,
        customerName: milestone.project.customer.name
      });
    }

    for (const milestone of overduePayments) {
      const notification = {
        userId: milestone.project.customer.assignedToId,
        title: "Khoản thanh toán đang quá hạn",
        message: `${milestone.name} đã quá hạn thanh toán từ ${milestone.dueDate?.toLocaleDateString("vi-VN") ?? "trước đó"}.`,
        type: "error",
        link: `/projects/${milestone.project.id}`
      };

      if (await this.hasMatchingNotificationToday(notification)) {
        continue;
      }

      await this.domainEvents.emit("payment.overdue", {
        userId: milestone.project.customer.assignedToId,
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        dueDate: milestone.dueDate?.toISOString() ?? null,
        paymentAmount: milestone.paymentAmount ? Number(milestone.paymentAmount) : null,
        projectId: milestone.project.id,
        projectName: milestone.project.name,
        customerId: milestone.project.customer.id,
        customerName: milestone.project.customer.name
      });
    }
  }

  private async dedupeNotifications(event: DomainEventName, inputs: CreateNotificationInput[]) {
    if (!["milestone.due_soon", "payment.overdue"].includes(event) || inputs.length === 0) {
      return inputs;
    }

    const deduped: CreateNotificationInput[] = [];

    for (const input of inputs) {
      if (!(await this.hasMatchingNotificationToday(input))) {
        deduped.push(input);
      }
    }

    return deduped;
  }

  private async hasMatchingNotificationToday(input: CreateNotificationInput) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await this.prisma.notification.findFirst({
      where: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        link: input.link ?? null,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      select: {
        id: true
      }
    });

    return Boolean(existing);
  }

  private async mapDomainEventToNotifications(event: DomainEventName, payload: Record<string, unknown>) {
    switch (event) {
      case "customer.assigned":
        return payload.assignedToId
          ? [
              {
                userId: String(payload.assignedToId),
                title: "Bạn vừa được giao khách hàng",
                message: `Khách hàng ${payload.customerName ?? "mới"} đã được giao cho bạn.`,
                type: "info",
                link: payload.customerId ? `/customers/${payload.customerId}` : "/customers"
              }
            ]
          : [];
      case "quote.accepted":
        return payload.ownerUserId
          ? [
              {
                userId: String(payload.ownerUserId),
                title: "Báo giá được chấp nhận",
                message: `Báo giá ${payload.quoteNo ?? ""} đã được khách hàng chấp nhận.`,
                type: "success",
                link: payload.quoteId ? `/quotes/${payload.quoteId}` : "/quotes"
              }
            ]
          : [];
      case "quote.rejected":
        return payload.ownerUserId
          ? [
              {
                userId: String(payload.ownerUserId),
                title: "Báo giá bị từ chối",
                message: `Báo giá ${payload.quoteNo ?? ""} đã bị từ chối.`,
                type: "warning",
                link: payload.quoteId ? `/quotes/${payload.quoteId}` : "/quotes"
              }
            ]
          : [];
      case "contract.signed":
      case "contract.completed":
        return payload.ownerUserId
          ? [
              {
                userId: String(payload.ownerUserId),
                title: event === "contract.signed" ? "Hợp đồng đã kích hoạt" : "Hợp đồng hoàn tất",
                message:
                  event === "contract.signed"
                    ? `Hợp đồng ${payload.contractNo ?? ""} đã chuyển sang hiệu lực.`
                    : `Hợp đồng ${payload.contractNo ?? ""} đã hoàn tất.`,
                type: event === "contract.signed" ? "success" : "info",
                link: payload.contractId ? `/contracts/${payload.contractId}` : "/contracts"
              }
            ]
          : [];
      case "payment.received":
        return payload.ownerUserId
          ? [
              {
                userId: String(payload.ownerUserId),
                title: "Đã ghi nhận thanh toán",
                message: `Khoản thanh toán mới đã được ghi nhận cho hợp đồng ${payload.contractNo ?? ""}.`,
                type: "success",
                link: payload.contractId ? `/contracts/${payload.contractId}` : "/contracts"
              }
            ]
          : [];
      case "milestone.due_soon":
        return payload.userId
          ? [
              {
                userId: String(payload.userId),
                title: "Milestone sắp đến hạn",
                message: `${payload.milestoneName ?? "Một milestone"} cần theo dõi trước ${payload.dueDate ? new Date(String(payload.dueDate)).toLocaleDateString("vi-VN") : "hạn chưa xác định"}.`,
                type: "warning",
                link: payload.projectId ? `/projects/${payload.projectId}` : "/projects"
              }
            ]
          : [];
      case "payment.overdue":
        return payload.userId
          ? [
              {
                userId: String(payload.userId),
                title: "Khoản thanh toán đang quá hạn",
                message: `${payload.milestoneName ?? "Một khoản thanh toán"} đã quá hạn từ ${payload.dueDate ? new Date(String(payload.dueDate)).toLocaleDateString("vi-VN") : "trước đó"}.`,
                type: "error",
                link: payload.projectId ? `/projects/${payload.projectId}` : "/projects"
              }
            ]
          : [];
      case "activity.assigned":
        return payload.userId
          ? [
              {
                userId: String(payload.userId),
                title: "Bạn có hoạt động mới",
                message: `Hoạt động ${payload.activityTitle ?? "mới"} vừa được giao cho bạn.`,
                type: "info",
                link: payload.activityId ? `/activities/${payload.activityId}` : "/activities"
              }
            ]
          : [];
      case "mention.created":
        return payload.userId
          ? [
              {
                userId: String(payload.userId),
                title: "Bạn được nhắc tới",
                message: String(payload.title ?? "Bạn vừa được nhắc tới trong hệ thống."),
                type: "info",
                link: payload.link ? String(payload.link) : "/activities"
              }
            ]
          : [];
      default:
        return [];
    }
  }
}
