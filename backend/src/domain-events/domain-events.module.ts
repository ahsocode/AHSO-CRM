import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PushModule } from "../push/push.module";
import { WebhooksModule } from "../webhooks/webhooks.module";
import { WebsocketModule } from "../websocket/websocket.module";
import { DomainEventsService } from "./domain-events.service";

@Module({
  imports: [WebhooksModule, WebsocketModule, NotificationsModule, PushModule],
  providers: [DomainEventsService],
  exports: [DomainEventsService]
})
export class DomainEventsModule {}
