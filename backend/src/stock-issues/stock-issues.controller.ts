import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateStockIssueDto, createStockIssueSchema } from "./dto/create-stock-issue.dto";
import { StockIssueFilterDto, stockIssueFilterSchema } from "./dto/stock-issue-filter.dto";
import { UpdateStockIssueDto, updateStockIssueSchema } from "./dto/update-stock-issue.dto";
import { StockIssuesService } from "./stock-issues.service";

@ApiTags("stock-issues")
@Controller("stock-issues")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockIssuesController {
  constructor(private readonly service: StockIssuesService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-issues" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(stockIssueFilterSchema, "query")) filters: StockIssueFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-issues/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("inventory.create")
  @ApiOperation({ summary: "POST /api/stock-issues" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createStockIssueSchema)) dto: CreateStockIssueDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "PATCH /api/stock-issues/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateStockIssueSchema)) dto: UpdateStockIssueDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-issues/:id/confirm" })
  @Post(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.confirm(id, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-issues/:id/cancel" })
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.cancel(id, user);
  }

  @RequirePermissions("inventory.delete")
  @ApiOperation({ summary: "DELETE /api/stock-issues/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }
}
