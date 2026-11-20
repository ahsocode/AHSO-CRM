import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ApiTokensService } from "./api-tokens.service";
import { CreateApiTokenDto, createApiTokenSchema } from "./dto/create-api-token.dto";

/** ADMIN only. Machine principals are always denied (no @RequireScope on any handler here). */
@ApiTags("api-tokens")
@ApiBearerAuth("bearer")
@Controller("api-tokens")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_VALUES[0])
export class ApiTokensController {
  constructor(private readonly service: ApiTokensService) {}

  @Post()
  @ApiOperation({ summary: "Tạo token tài khoản máy (trả token dạng rõ đúng một lần)" })
  create(
    @Body(new ZodValidationPipe(createApiTokenSchema)) dto: CreateApiTokenDto,
    @CurrentUser() user: JwtUser,
    @Req() req: { ip?: string }
  ) {
    return this.service.create(dto, user, req.ip ?? null);
  }

  @Get()
  @ApiOperation({ summary: "Danh sách token tài khoản máy (không có hash)" })
  list() {
    return this.service.list();
  }

  @Delete(":id")
  @ApiOperation({ summary: "Thu hồi token tài khoản máy" })
  revoke(@Param("id") id: string, @CurrentUser() user: JwtUser, @Req() req: { ip?: string }) {
    return this.service.revoke(id, user, req.ip ?? null);
  }
}
