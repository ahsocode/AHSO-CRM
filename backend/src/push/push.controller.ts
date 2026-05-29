import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PushSubscriptionDto, pushSubscriptionSchema } from "./dto/push-subscription.dto";
import { PushService } from "./push.service";

@ApiTags("push")
@Controller("push/subscriptions")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Public()
  @ApiOperation({ summary: "GET /api/push/subscriptions/vapid-public-key — trả VAPID public key cho browser subscribe" })
  @Get("vapid-public-key")
  getVapidPublicKey() {
    return this.pushService.getVapidPublicKey();
  }

  @RequirePermissions("notifications.edit")
  @ApiOperation({ summary: "POST /api/push/subscriptions" })
  @Post()
  saveSubscription(
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) dto: PushSubscriptionDto,
    @CurrentUser() user: JwtUser,
    @Req() request: Request
  ) {
    return this.pushService.saveSubscription(user.sub, dto, request.get("user-agent") ?? null);
  }

  @RequirePermissions("notifications.edit")
  @ApiOperation({ summary: "DELETE /api/push/subscriptions/:id" })
  @Delete(":id")
  removeSubscription(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.pushService.removeSubscription(id, user.sub);
  }
}
