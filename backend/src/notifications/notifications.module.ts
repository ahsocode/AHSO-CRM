import { forwardRef, Module } from "@nestjs/common";
import { DomainEventsModule } from "../domain-events/domain-events.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [forwardRef(() => DomainEventsModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
