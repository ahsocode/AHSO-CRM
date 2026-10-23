import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAnyPermissions, RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BomsService } from "./boms.service";
import {
  BomModelFilterDto,
  CreateProjectBomDto,
  ReplaceBomLinesDto,
  SaveAsModelDto,
  SuggestAllocationDto,
  UpdateBomDto,
  bomModelFilterSchema,
  createProjectBomSchema,
  replaceBomLinesSchema,
  saveAsModelSchema,
  suggestAllocationSchema,
  updateBomSchema
} from "./dto/bom.dto";

// Project-scoped routes check projects.*; MODEL BOMs are re-checked against materials.* in the service (R11).
@ApiTags("boms")
@Controller()
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BomsController {
  constructor(private readonly boms: BomsService) {}

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/boms" })
  @Get("projects/:id/boms")
  listProjectBoms(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.boms.listProjectBoms(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/projects/:id/boms" })
  @Post("projects/:id/boms")
  createProjectBom(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createProjectBomSchema)) dto: CreateProjectBomDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.boms.createProjectBom(id, dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "POST /api/projects/:id/material-allocations/suggest" })
  @Post("projects/:id/material-allocations/suggest")
  suggestAllocation(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(suggestAllocationSchema)) dto: SuggestAllocationDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.boms.suggestAllocation(id, dto, user);
  }

  // Declared before boms/:id so "models" is not treated as an id
  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "GET /api/boms/models" })
  @Get("boms/models")
  listModels(
    @Query(new ZodValidationPipe(bomModelFilterSchema, "query")) filters: BomModelFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.boms.listModels(filters, user);
  }

  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "GET /api/boms/models/:productId/versions" })
  @Get("boms/models/:productId/versions")
  listModelVersions(@Param("productId") productId: string, @CurrentUser() user: JwtUser) {
    return this.boms.listModelVersions(productId, user);
  }

  @RequireAnyPermissions("projects.view", "materials.view")
  @ApiOperation({ summary: "GET /api/boms/:id" })
  @Get("boms/:id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.boms.findOne(id, user);
  }

  @RequireAnyPermissions("projects.edit", "materials.edit")
  @ApiOperation({ summary: "PATCH /api/boms/:id" })
  @Patch("boms/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBomSchema)) dto: UpdateBomDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.boms.update(id, dto, user);
  }

  @RequireAnyPermissions("projects.edit", "materials.edit")
  @ApiOperation({ summary: "PUT /api/boms/:id/lines" })
  @Put("boms/:id/lines")
  replaceLines(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(replaceBomLinesSchema)) dto: ReplaceBomLinesDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.boms.replaceLines(id, dto, user);
  }

  @RequireAnyPermissions("projects.edit", "materials.edit")
  @ApiOperation({ summary: "POST /api/boms/:id/approve" })
  @Post("boms/:id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.boms.approve(id, user);
  }

  @RequireAnyPermissions("projects.edit", "materials.edit")
  @ApiOperation({ summary: "POST /api/boms/:id/new-version" })
  @Post("boms/:id/new-version")
  newVersion(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.boms.createNewVersion(id, user);
  }

  @RequireAnyPermissions("projects.edit", "materials.edit")
  @ApiOperation({ summary: "POST /api/boms/:id/archive" })
  @Post("boms/:id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.boms.archive(id, user);
  }

  @RequirePermissions("projects.view", "materials.edit")
  @ApiOperation({ summary: "POST /api/boms/:id/save-as-model" })
  @Post("boms/:id/save-as-model")
  saveAsModel(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(saveAsModelSchema)) dto: SaveAsModelDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.boms.saveAsModel(id, dto, user);
  }

  @RequireAnyPermissions("projects.edit", "materials.edit")
  @ApiOperation({ summary: "DELETE /api/boms/:id" })
  @Delete("boms/:id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.boms.remove(id, user);
  }
}
