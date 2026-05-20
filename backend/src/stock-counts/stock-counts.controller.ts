import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateStockCountDto, createStockCountSchema } from "./dto/create-stock-count.dto";
import { StockCountFilterDto, stockCountFilterSchema } from "./dto/stock-count-filter.dto";
import { UpdateStockCountDto, updateStockCountSchema } from "./dto/update-stock-count.dto";
import { StockCountsService } from "./stock-counts.service";

@ApiTags("stock-counts")
@Controller("stock-counts")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockCountsController {
  constructor(private readonly service: StockCountsService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-counts" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(stockCountFilterSchema, "query")) filters: StockCountFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-counts/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("inventory.create")
  @ApiOperation({ summary: "POST /api/stock-counts" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createStockCountSchema)) dto: CreateStockCountDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "PATCH /api/stock-counts/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateStockCountSchema)) dto: UpdateStockCountDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-counts/:id/confirm" })
  @Post(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.confirm(id, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-counts/:id/cancel" })
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.cancel(id, user);
  }

  @RequirePermissions("inventory.delete")
  @ApiOperation({ summary: "DELETE /api/stock-counts/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }
}
