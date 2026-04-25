import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../push/push.service";
import { WebhooksEmitter } from "../webhooks/webhooks.emitter";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { DomainEventsService } from "./domain-events.service";

describe("DomainEventsService", () => {
  let service: DomainEventsService;
  let webhooksEmitter: { emit: jest.Mock };
  let websocketGateway: {
    publishToUser: jest.Mock;
    publishToAdmin: jest.Mock;
  };
  let notificationsService: { handleDomainEvent: jest.Mock };
  let pushService: { handleDomainEvent: jest.Mock };

  beforeEach(() => {
    webhooksEmitter = { emit: jest.fn() };
    websocketGateway = {
      publishToUser: jest.fn(),
      publishToAdmin: jest.fn()
    };
    notificationsService = { handleDomainEvent: jest.fn().mockResolvedValue([]) };
    pushService = { handleDomainEvent: jest.fn().mockResolvedValue(undefined) };

    service = new DomainEventsService(
      webhooksEmitter as unknown as WebhooksEmitter,
      websocketGateway as unknown as WebsocketGateway,
      notificationsService as unknown as NotificationsService,
      pushService as unknown as PushService
    );
  });

  it("routes admin-facing business events only to the admin room", async () => {
    const envelope = await service.emit("project.status_changed", {
      projectId: "project-1",
      status: "WON"
    });

    expect(envelope).toMatchObject({
      id: expect.any(String),
      event: "project.status_changed",
      payload: {
        projectId: "project-1",
        status: "WON"
      },
      occurredAt: expect.any(String)
    });
    expect(webhooksEmitter.emit).toHaveBeenCalledWith("project.status_changed", {
      projectId: "project-1",
      status: "WON"
    });
    expect(websocketGateway.publishToAdmin).toHaveBeenCalledWith(envelope);
    expect(websocketGateway.publishToUser).not.toHaveBeenCalled();
    expect(notificationsService.handleDomainEvent).toHaveBeenCalledWith(envelope);
    expect(pushService.handleDomainEvent).toHaveBeenCalledWith(envelope);
  });

  it("routes targeted events to the target user without global broadcast", async () => {
    const envelope = await service.emit("activity.assigned", {
      userId: "user-1",
      activityId: "activity-1",
      activityTitle: "Gọi khách hàng"
    });

    expect(websocketGateway.publishToUser).toHaveBeenCalledWith("user-1", envelope);
    expect(websocketGateway.publishToAdmin).not.toHaveBeenCalled();
  });

  it("routes dual-visibility events to both admin and target user with one shared event id", async () => {
    const envelope = await service.emit("quote.accepted", {
      ownerUserId: "owner-1",
      quoteId: "quote-1",
      quoteNo: "BG-001"
    });

    expect(websocketGateway.publishToUser).toHaveBeenCalledWith("owner-1", envelope);
    expect(websocketGateway.publishToAdmin).toHaveBeenCalledWith(envelope);
    expect(websocketGateway.publishToUser.mock.calls[0][1].id).toBe(
      websocketGateway.publishToAdmin.mock.calls[0][0].id
    );
  });
});
