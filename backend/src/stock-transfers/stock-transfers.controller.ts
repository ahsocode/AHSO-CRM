import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateStockTransferDto, createStockTransferSchema } from "./dto/create-stock-transfer.dto";
import { StockTransferFilterDto, stockTransferFilterSchema } from "./dto/stock-transfer-filter.dto";
import { UpdateStockTransferDto, updateStockTransferSchema } from "./dto/update-stock-transfer.dto";
import { StockTransfersService } from "./stock-transfers.service";

@ApiTags("stock-transfers")
@Controller("stock-transfers")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockTransfersController {
  constructor(private readonly service: StockTransfersService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-transfers" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(stockTransferFilterSchema, "query")) filters: StockTransferFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-transfers/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("inventory.create")
  @ApiOperation({ summary: "POST /api/stock-transfers" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createStockTransferSchema)) dto: CreateStockTransferDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "PATCH /api/stock-transfers/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateStockTransferSchema)) dto: UpdateStockTransferDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-transfers/:id/confirm" })
  @Post(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.confirm(id, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-transfers/:id/cancel" })
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.cancel(id, user);
  }

  @RequirePermissions("inventory.delete")
  @ApiOperation({ summary: "DELETE /api/stock-transfers/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }
}
