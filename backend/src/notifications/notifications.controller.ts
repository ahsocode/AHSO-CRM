import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  NotificationFilterDto,
  notificationFilterSchema
} from "./dto/notification-filter.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @RequirePermissions("notifications.view")
  @Get()
  list(
    @Query(new ZodValidationPipe(notificationFilterSchema, "query")) filters: NotificationFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.notificationsService.list(filters, user);
  }

  @RequirePermissions("notifications.view")
  @Get("unread-count")
  getUnreadCount(@CurrentUser() user: JwtUser) {
    return this.notificationsService.getUnreadCount(user);
  }

  @RequirePermissions("notifications.edit")
  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.markRead(id, user);
  }

  @RequirePermissions("notifications.edit")
  @Patch("read-all")
  markReadAll(@CurrentUser() user: JwtUser) {
    return this.notificationsService.markReadAll(user);
  }
}
