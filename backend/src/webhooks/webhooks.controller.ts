import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { CreateWebhookDto, createWebhookSchema } from "./dto/create-webhook.dto";
import { UpdateWebhookDto, updateWebhookSchema } from "./dto/update-webhook.dto";
import { WebhookLogFilterDto, webhookLogFilterSchema } from "./dto/webhook-log-filter.dto";
import { WebhooksService } from "./webhooks.service";

@ApiTags("webhooks")
@ApiBearerAuth("bearer")
@Controller("webhooks")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_VALUES[0])
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: "Lấy danh sách webhook" })
  findAll() {
    return this.webhooksService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Tạo webhook mới" })
  create(
    @Body(new ZodValidationPipe(createWebhookSchema)) input: CreateWebhookDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.webhooksService.create(input, user.sub);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Cập nhật webhook" })
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateWebhookSchema)) input: UpdateWebhookDto
  ) {
    return this.webhooksService.update(id, input);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Xóa webhook" })
  remove(@Param("id") id: string) {
    return this.webhooksService.remove(id);
  }

  @Get(":id/logs")
  @ApiOperation({ summary: "Xem lịch sử gửi webhook" })
  getLogs(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(webhookLogFilterSchema, "query")) filters: WebhookLogFilterDto
  ) {
    return this.webhooksService.getLogs(id, filters);
  }
}

