import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateWarehouseDto, createWarehouseSchema } from "./dto/create-warehouse.dto";
import { WarehouseFilterDto, warehouseFilterSchema } from "./dto/inventory-balance-filter.dto";
import { UpdateWarehouseDto, updateWarehouseSchema } from "./dto/update-warehouse.dto";
import { WarehousesService } from "./warehouses.service";

@ApiTags("warehouses")
@Controller("warehouses")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly service: WarehousesService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/warehouses" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(warehouseFilterSchema, "query")) filters: WarehouseFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/warehouses/select" })
  @Get("select")
  findAllSelect(@CurrentUser() user: JwtUser) {
    return this.service.findAllSelect(user);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/warehouses/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("inventory.create")
  @ApiOperation({ summary: "POST /api/warehouses" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createWarehouseSchema)) dto: CreateWarehouseDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "PATCH /api/warehouses/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateWarehouseSchema)) dto: UpdateWarehouseDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("inventory.delete")
  @ApiOperation({ summary: "DELETE /api/warehouses/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }
}
