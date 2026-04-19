import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PushSubscriptionDto, pushSubscriptionSchema } from "./dto/push-subscription.dto";
import { PushService } from "./push.service";

@Controller("push/subscriptions")
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post()
  saveSubscription(
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) dto: PushSubscriptionDto,
    @CurrentUser() user: JwtUser,
    @Req() request: Request
  ) {
    return this.pushService.saveSubscription(user.sub, dto, request.get("user-agent") ?? null);
  }

  @Delete(":id")
  removeSubscription(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.pushService.removeSubscription(id, user.sub);
  }
}
