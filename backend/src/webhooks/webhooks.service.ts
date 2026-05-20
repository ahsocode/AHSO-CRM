import { Injectable, NotFoundException } from "@nestjs/common";
import { createHmac, randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { CreateWebhookDto, WebhookEventName } from "./dto/create-webhook.dto";
import { UpdateWebhookDto } from "./dto/update-webhook.dto";
import { WebhookLogFilterDto } from "./dto/webhook-log-filter.dto";

const RETRY_DELAYS_MS = [1_000, 4_000, 16_000] as const;

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.webhook.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async create(input: CreateWebhookDto, createdBy: string) {
    return this.prisma.webhook.create({
      data: {
        url: input.url,
        events: input.events,
        isActive: input.isActive ?? true,
        secret: randomBytes(32).toString("hex"),
        createdById: createdBy
      }
    });
  }

  async update(id: string, input: UpdateWebhookDto) {
    await this.ensureWebhookExists(id);

    return this.prisma.webhook.update({
      where: {
        id
      },
      data: input
    });
  }

  async remove(id: string) {
    await this.ensureWebhookExists(id);

    return this.prisma.webhook.delete({
      where: {
        id
      }
    });
  }

  async getLogs(id: string, filters: WebhookLogFilterDto) {
    await this.ensureWebhookExists(id);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.webhookLog.findMany({
        where: {
          webhookId: id
        },
        skip,
        take: limit,
        orderBy: {
          firedAt: "desc"
        }
      }),
      this.prisma.webhookLog.count({
        where: {
          webhookId: id
        }
      })
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async emit(event: WebhookEventName, payload: unknown) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event
        }
      }
    });

    await Promise.allSettled(
      webhooks.map((webhook) => this.deliver(webhook.id, webhook.url, webhook.secret, event, payload))
    );
  }

  private async deliver(
    webhookId: string,
    url: string,
    secret: string,
    event: WebhookEventName,
    payload: unknown
  ) {
    const body = JSON.stringify(payload);
    const signature = this.signPayload(secret, body);
    let lastResponseText: string | null = null;
    let lastStatusCode: number | null = null;
    let delivered = false;

    for (const delay of RETRY_DELAYS_MS) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Event": event,
          "X-Webhook-Id": webhookId,
          "X-Signature": signature
        },
        body
      }).catch((error: unknown) => ({
        ok: false,
        status: 0,
        text: async () =>
          error instanceof Error ? error.message : "Không thể gửi webhook tới endpoint đích"
      }));

      lastStatusCode = "status" in response ? response.status : 0;
      lastResponseText = "text" in response ? await response.text() : "Không nhận được phản hồi";

      if ("ok" in response && response.ok) {
        delivered = true;
        break;
      }

      await this.delay(delay);
    }

    await this.prisma.$transaction([
      this.prisma.webhookLog.create({
        data: {
          webhookId,
          event,
          payload: payload as object,
          response: lastResponseText,
          statusCode: lastStatusCode
        }
      }),
      this.prisma.webhook.update({
        where: {
          id: webhookId
        },
        data: delivered
          ? {
              lastFired: new Date(),
              failCount: 0
            }
          : {
              failCount: {
                increment: 1
              }
            }
      })
    ]);
  }

  private signPayload(secret: string, body: string) {
    return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }

  private async ensureWebhookExists(id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: {
        id
      },
      select: {
        id: true
      }
    });

    if (!webhook) {
      throw new NotFoundException("Không tìm thấy webhook");
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
