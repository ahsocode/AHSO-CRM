import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateMaterialDto, createMaterialSchema } from "./dto/create-material.dto";
import { MaterialFilterDto, materialFilterSchema } from "./dto/material-filter.dto";
import { UpdateMaterialDto, updateMaterialSchema } from "./dto/update-material.dto";
import { UpsertMaterialSuppliersDto, upsertMaterialSuppliersSchema } from "./dto/upsert-material-supplier.dto";
import { MaterialsService } from "./materials.service";

@ApiTags("materials")
@Controller("materials")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}

  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "GET /api/materials" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(materialFilterSchema, "query")) filters: MaterialFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "GET /api/materials/select" })
  @Get("select")
  findAllSelect(@CurrentUser() user: JwtUser, @Query("search") search?: string) {
    return this.service.findAllSelect(user, search);
  }

  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "GET /api/materials/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("materials.create")
  @ApiOperation({ summary: "POST /api/materials" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createMaterialSchema)) dto: CreateMaterialDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("materials.edit")
  @ApiOperation({ summary: "PATCH /api/materials/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMaterialSchema)) dto: UpdateMaterialDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("materials.delete")
  @ApiOperation({ summary: "DELETE /api/materials/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }

  @RequirePermissions("materials.edit")
  @ApiOperation({ summary: "PUT /api/materials/:id/suppliers" })
  @Put(":id/suppliers")
  replaceSuppliers(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertMaterialSuppliersSchema)) dto: UpsertMaterialSuppliersDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.replaceSuppliers(id, dto, user);
  }

  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "POST /api/materials/bulk — export selected rows" })
  @Post("bulk")
  bulk(@Body() dto: { action: "export"; ids: string[] }) {
    return this.service.bulkExport(dto.ids);
  }
}
