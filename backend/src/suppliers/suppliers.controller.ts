import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateSupplierDto, createSupplierSchema } from "./dto/create-supplier.dto";
import { SupplierFilterDto, supplierFilterSchema } from "./dto/supplier-filter.dto";
import { UpdateSupplierDto, updateSupplierSchema } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@Controller("suppliers")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @RequirePermissions("suppliers.view")
  @ApiOperation({ summary: "GET /api/suppliers" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(supplierFilterSchema, "query")) filters: SupplierFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("suppliers.view")
  @ApiOperation({ summary: "GET /api/suppliers/select" })
  @Get("select")
  findAllSelect(@CurrentUser() user: JwtUser) {
    return this.service.findAllSelect(user);
  }

  @RequirePermissions("suppliers.view")
  @ApiOperation({ summary: "GET /api/suppliers/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("suppliers.create")
  @ApiOperation({ summary: "POST /api/suppliers" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplierDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("suppliers.edit")
  @ApiOperation({ summary: "PATCH /api/suppliers/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplierDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("suppliers.delete")
  @ApiOperation({ summary: "DELETE /api/suppliers/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }

  @RequirePermissions("suppliers.view")
  @ApiOperation({ summary: "POST /api/suppliers/bulk — export selected rows" })
  @Post("bulk")
  bulk(@Body() dto: { action: "export"; ids: string[] }) {
    return this.service.bulkExport(dto.ids);
  }
}
