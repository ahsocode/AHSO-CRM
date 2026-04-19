import { Injectable } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

@Injectable()
export class WebhooksEmitter {
  constructor(private readonly webhooksService: WebhooksService) {}

  emit(event: string, payload: unknown) {
    void this.webhooksService.emit(event as never, payload);
  }
}
