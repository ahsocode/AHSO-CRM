import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PushSubscriptionDto, pushSubscriptionSchema } from "./dto/push-subscription.dto";
import { PushService } from "./push.service";

@Controller("push/subscriptions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @RequirePermissions("notifications.edit")
  @Post()
  saveSubscription(
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) dto: PushSubscriptionDto,
    @CurrentUser() user: JwtUser,
    @Req() request: Request
  ) {
    return this.pushService.saveSubscription(user.sub, dto, request.get("user-agent") ?? null);
  }

  @RequirePermissions("notifications.edit")
  @Delete(":id")
  removeSubscription(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.pushService.removeSubscription(id, user.sub);
  }
}
