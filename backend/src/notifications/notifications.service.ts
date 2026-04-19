import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma.service";
import { JwtUser } from "../auth/auth.types";
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
  constructor(private readonly prisma: PrismaService) {}

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
    return this.createMany(notifications);
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

    return this.createMany(
      users.map((user) => ({
        userId: user.id,
        title: "Bạn được nhắc tới",
        message: context.title,
        type: "info",
        link: context.link ?? null
      }))
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
              customer: {
                select: {
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
          project: {
            select: {
              id: true,
              customer: {
                select: {
                  assignedToId: true
                }
              }
            }
          }
        }
      })
    ]);

    await this.createMany([
      ...dueMilestones.map((milestone) => ({
        userId: milestone.project.customer.assignedToId,
        title: "Milestone sắp đến hạn",
        message: `${milestone.name} cần theo dõi trước ${milestone.dueDate?.toLocaleDateString("vi-VN") ?? "hạn chưa xác định"}.`,
        type: "warning",
        link: `/projects/${milestone.project.id}`
      })),
      ...overduePayments.map((milestone) => ({
        userId: milestone.project.customer.assignedToId,
        title: "Khoản thanh toán đang quá hạn",
        message: `${milestone.name} đã quá hạn thanh toán từ ${milestone.dueDate?.toLocaleDateString("vi-VN") ?? "trước đó"}.`,
        type: "error",
        link: `/projects/${milestone.project.id}`
      }))
    ]);
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
      default:
        return [];
    }
  }
}
