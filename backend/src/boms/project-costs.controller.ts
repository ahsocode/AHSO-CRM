import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CostReportsService } from "./cost-reports.service";
import {
  CreateProjectCostDto,
  ProjectCostFilterDto,
  UpdateProjectCostDto,
  createProjectCostSchema,
  projectCostFilterSchema,
  updateProjectCostSchema
} from "./dto/project-cost.dto";
import { ProjectCostsService } from "./project-costs.service";

@ApiTags("project-costs")
@Controller()
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectCostsController {
  constructor(
    private readonly costs: ProjectCostsService,
    private readonly reports: CostReportsService
  ) {}

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/costs" })
  @Get("projects/:id/costs")
  list(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(projectCostFilterSchema, "query")) filters: ProjectCostFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.costs.list(id, filters, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/projects/:id/costs" })
  @Post("projects/:id/costs")
  create(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createProjectCostSchema)) dto: CreateProjectCostDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.costs.create(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/project-costs/:id" })
  @Patch("project-costs/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectCostSchema)) dto: UpdateProjectCostDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.costs.update(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "DELETE /api/project-costs/:id" })
  @Delete("project-costs/:id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.costs.remove(id, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/cost-summary" })
  @Get("projects/:id/cost-summary")
  costSummary(@Param("id") id: string, @Query("bomId") bomId: string | undefined, @CurrentUser() user: JwtUser) {
    return this.reports.getCostSummary(id, user, bomId?.trim() || undefined);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/material-allocations/:id/cost-sheet" })
  @Get("material-allocations/:id/cost-sheet")
  costSheet(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.reports.getCostSheet(id, user);
  }
}
