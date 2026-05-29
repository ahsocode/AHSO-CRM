import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import { PrismaService } from "../common/prisma.service";
import { DomainEventEnvelope } from "../domain-events/domain-events.types";
import { PushSubscriptionDto } from "./dto/push-subscription.dto";

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    const publicKey = this.configService.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.configService.get<string>("VAPID_PRIVATE_KEY");
    const subject = this.configService.get<string>("VAPID_SUBJECT");

    if (publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  getVapidPublicKey() {
    const publicKey = this.configService.get<string>("VAPID_PUBLIC_KEY");
    return { publicKey: publicKey ?? null };
  }

  async saveSubscription(userId: string, dto: PushSubscriptionDto, userAgent?: string | null) {
    return this.prisma.pushSubscription.upsert({
      where: {
        endpoint: dto.endpoint
      },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ?? null
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent ?? null
      }
    });
  }

  async removeSubscription(id: string, userId: string) {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: {
        id,
        userId
      }
    });

    return {
      success: result.count > 0
    };
  }

  async notifyUser(userId: string, payload: Record<string, unknown>) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        userId
      }
    });

    if (subscriptions.length === 0) {
      return;
    }

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
              }
            },
            JSON.stringify(payload)
          );
        } catch (error) {
          this.logger.warn(
            `Không gửi được push notification tới ${subscription.id}: ${error instanceof Error ? error.message : "unknown"}`
          );
        }
      })
    );
  }

  async handleDomainEvent(envelope: DomainEventEnvelope) {
    const targetUserId = this.resolveTargetUserId(envelope.payload);

    if (!targetUserId) {
      return;
    }

    await this.notifyUser(targetUserId, {
      title: this.resolveTitle(envelope),
      body: this.resolveBody(envelope),
      link: this.resolveLink(envelope.payload),
      event: envelope.event,
      occurredAt: envelope.occurredAt
    });
  }

  private resolveTargetUserId(payload: Record<string, unknown>) {
    const candidate = payload.assignedToId ?? payload.ownerUserId ?? payload.userId;
    return candidate ? String(candidate) : null;
  }

  private resolveTitle(envelope: DomainEventEnvelope) {
    switch (envelope.event) {
      case "customer.assigned":
        return "Khách hàng mới được giao";
      case "quote.accepted":
        return "Báo giá được chấp nhận";
      case "quote.rejected":
        return "Báo giá bị từ chối";
      case "contract.signed":
        return "Hợp đồng đã kích hoạt";
      case "contract.completed":
        return "Hợp đồng hoàn tất";
      case "payment.received":
        return "Đã ghi nhận thanh toán";
      case "payment.overdue":
        return "Thanh toán đang quá hạn";
      case "milestone.due_soon":
        return "Milestone sắp đến hạn";
      case "activity.assigned":
        return "Bạn có hoạt động mới";
      case "mention.created":
        return "Bạn được nhắc tới";
      default:
        return "AHSO CRM cập nhật mới";
    }
  }

  private resolveBody(envelope: DomainEventEnvelope) {
    switch (envelope.event) {
      case "customer.assigned":
        return `Khách hàng ${envelope.payload.customerName ?? ""} vừa được giao cho bạn.`;
      case "quote.accepted":
        return `Báo giá ${envelope.payload.quoteNo ?? ""} vừa được chấp nhận.`;
      case "quote.rejected":
        return `Báo giá ${envelope.payload.quoteNo ?? ""} vừa bị từ chối.`;
      case "contract.signed":
        return `Hợp đồng ${envelope.payload.contractNo ?? ""} đã chuyển sang hiệu lực.`;
      case "contract.completed":
        return `Hợp đồng ${envelope.payload.contractNo ?? ""} đã hoàn tất.`;
      case "payment.received":
        return `Một khoản thanh toán mới đã được ghi nhận.`;
      case "payment.overdue":
        return `${envelope.payload.milestoneName ?? "Một khoản thanh toán"} đang quá hạn cần xử lý.`;
      case "milestone.due_soon":
        return `${envelope.payload.milestoneName ?? "Một milestone"} sắp tới hạn.`;
      case "activity.assigned":
        return `Hoạt động ${envelope.payload.activityTitle ?? ""} vừa được giao cho bạn.`;
      case "mention.created":
        return String(envelope.payload.title ?? "Bạn vừa được nhắc tới trong hệ thống.");
      default:
        return "Có cập nhật mới trong hệ thống.";
    }
  }

  private resolveLink(payload: Record<string, unknown>) {
    if (payload.customerId) return `/customers/${payload.customerId}`;
    if (payload.quoteId) return `/quotes/${payload.quoteId}`;
    if (payload.contractId) return `/contracts/${payload.contractId}`;
    if (payload.projectId) return `/projects/${payload.projectId}`;
    return "/dashboard";
  }
}
