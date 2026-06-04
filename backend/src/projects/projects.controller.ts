import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { hasPermission, JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreatePaymentDto, createPaymentSchema } from "../contracts/dto/create-payment.dto";
import { CreateProjectHandoverDto, createProjectHandoverSchema } from "./dto/create-project-handover.dto";
import { CreateProjectDto, createProjectSchema } from "./dto/create-project.dto";
import { BulkProjectDto, bulkProjectSchema } from "./dto/bulk-project.dto";
import { ProjectFilterDto, projectFilterSchema } from "./dto/project-filter.dto";
import {
  GenerateProjectDocumentPlanDto,
  generateProjectDocumentPlanSchema,
  UpdateProjectDocumentPlanDto,
  updateProjectDocumentPlanSchema
} from "./dto/project-document-plan.dto";
import {
  EligibleStockLotsDto,
  UpsertProjectMaterialAllocationDto,
  eligibleStockLotsSchema,
  upsertProjectMaterialAllocationSchema
} from "./dto/project-material-allocation.dto";
import { UpdateProjectDto, updateProjectSchema } from "./dto/update-project.dto";
import { UpdateProjectStatusDto, updateProjectStatusSchema } from "./dto/update-project-status.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@Controller("projects")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(projectFilterSchema, "query")) filters: ProjectFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.findAll(filters, user);
  }

  @RequirePermissions("projects.create")
  @ApiOperation({ summary: "POST /api/projects" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.create(dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "POST /api/projects/bulk" })
  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkProjectSchema)) dto: BulkProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    this.assertBulkPermission(user, dto.action);
    return this.projectsService.bulk(dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/deleted" })
  @Get("deleted")
  findDeleted(
    @Query(new ZodValidationPipe(projectFilterSchema, "query")) filters: ProjectFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.findDeleted(filters, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.findOne(id, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/overview-360" })
  @Get(":id/overview-360")
  getOverview360(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getOverview360(id, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/timeline" })
  @Get(":id/timeline")
  getTimeline(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getTimeline(id, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/documents" })
  @Get(":id/documents")
  getDocuments(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getDocuments(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/projects/:id/document-plan" })
  @Patch(":id/document-plan")
  updateDocumentPlan(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectDocumentPlanSchema)) dto: UpdateProjectDocumentPlanDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.updateDocumentPlan(id, dto, user);
  }

  @RequirePermissions("documents.create")
  @ApiOperation({ summary: "POST /api/projects/:id/document-plan/generate" })
  @Post(":id/document-plan/generate")
  generateDocumentPlan(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(generateProjectDocumentPlanSchema)) dto: GenerateProjectDocumentPlanDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.generateDocumentPlan(id, dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/surveys" })
  @Get(":id/surveys")
  getSurveys(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getSurveys(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/projects/:id/handovers" })
  @Post(":id/handovers")
  createHandover(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createProjectHandoverSchema)) dto: CreateProjectHandoverDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.createHandover(id, dto, user);
  }

  @RequirePermissions("payments.create")
  @ApiOperation({ summary: "POST /api/projects/:id/payments" })
  @Post(":id/payments")
  createPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) dto: CreatePaymentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.createPayment(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/projects/:id/restore" })
  @Patch(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.restore(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/projects/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/projects/:id/status" })
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) dto: UpdateProjectStatusDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.updateStatus(id, dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/material-allocation" })
  @Get(":id/material-allocation")
  getMaterialAllocation(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getMaterialAllocation(id, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/projects/:id/eligible-stock-lots" })
  @Get(":id/eligible-stock-lots")
  getEligibleStockLots(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(eligibleStockLotsSchema, "query")) dto: EligibleStockLotsDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.getEligibleStockLots(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/projects/:id/material-allocation" })
  @Post(":id/material-allocation")
  upsertMaterialAllocation(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertProjectMaterialAllocationSchema)) dto: UpsertProjectMaterialAllocationDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.upsertMaterialAllocation(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/projects/:id/material-allocation" })
  @Patch(":id/material-allocation")
  patchMaterialAllocation(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertProjectMaterialAllocationSchema)) dto: UpsertProjectMaterialAllocationDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.upsertMaterialAllocation(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/projects/:id/material-allocation/confirm" })
  @Post(":id/material-allocation/confirm")
  confirmMaterialAllocation(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.confirmMaterialAllocation(id, user);
  }

  @RequirePermissions("projects.delete")
  @ApiOperation({ summary: "DELETE /api/projects/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.remove(id, user);
  }

  private assertBulkPermission(user: JwtUser, action: BulkProjectDto["action"]) {
    const permission =
      action === "status"
        ? "projects.edit"
        : action === "delete"
          ? "projects.delete"
          : "projects.view";

    if (!hasPermission(user, permission)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
  }
}
