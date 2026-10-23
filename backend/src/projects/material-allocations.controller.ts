import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  UpsertProjectMaterialAllocationDto,
  upsertProjectMaterialAllocationSchema
} from "./dto/project-material-allocation.dto";
import { ProjectsService } from "./projects.service";

/** Per-allocation operations (one allocation = one sales invoice, R10). */
@ApiTags("material-allocations")
@Controller("material-allocations")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaterialAllocationsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/material-allocations/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getMaterialAllocationById(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PUT /api/material-allocations/:id" })
  @Put(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertProjectMaterialAllocationSchema)) dto: UpsertProjectMaterialAllocationDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.updateMaterialAllocationById(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/material-allocations/:id/confirm" })
  @Post(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.confirmMaterialAllocationById(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/material-allocations/:id/cancel" })
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.cancelMaterialAllocation(id, user);
  }
}
