import { Injectable } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../push/push.service";
import { WebhooksEmitter } from "../webhooks/webhooks.emitter";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { DomainEventEnvelope, DomainEventName } from "./domain-events.types";

@Injectable()
export class DomainEventsService {
  constructor(
    private readonly webhooksEmitter: WebhooksEmitter,
    private readonly websocketGateway: WebsocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService
  ) {}

  async emit<TPayload extends Record<string, unknown>>(event: DomainEventName, payload: TPayload) {
    const envelope: DomainEventEnvelope<TPayload> = {
      event,
      payload,
      occurredAt: new Date().toISOString()
    };

    this.webhooksEmitter.emit(event, payload);
    this.websocketGateway.publish(envelope);

    const targetUserId = this.resolveTargetUserId(payload);

    if (targetUserId) {
      this.websocketGateway.publishToUser(targetUserId, envelope);
    }

    if (this.isAdminFacingEvent(event)) {
      this.websocketGateway.publishToAdmin(envelope);
    }

    await Promise.allSettled([
      this.notificationsService.handleDomainEvent(envelope),
      this.pushService.handleDomainEvent(envelope)
    ]);

    return envelope;
  }

  private resolveTargetUserId(payload: Record<string, unknown>) {
    const candidate = payload.assignedToId ?? payload.ownerUserId ?? payload.userId;
    return candidate ? String(candidate) : null;
  }

  private isAdminFacingEvent(event: DomainEventName) {
    return [
      "customer.created",
      "customer.updated",
      "customer.deleted",
      "project.created",
      "project.status_changed",
      "quote.sent",
      "quote.accepted",
      "quote.rejected",
      "contract.signed",
      "contract.completed",
      "payment.received"
    ].includes(event);
  }
}
