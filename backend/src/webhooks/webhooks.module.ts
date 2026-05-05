import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksEmitter } from "./webhooks.emitter";
import { WebhooksService } from "./webhooks.service";

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksEmitter],
  exports: [WebhooksService, WebhooksEmitter]
})
export class WebhooksModule {}
