import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { hasPermission, JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateProjectHandoverDto, createProjectHandoverSchema } from "./dto/create-project-handover.dto";
import { CreateProjectDto, createProjectSchema } from "./dto/create-project.dto";
import { BulkProjectDto, bulkProjectSchema } from "./dto/bulk-project.dto";
import { ProjectFilterDto, projectFilterSchema } from "./dto/project-filter.dto";
import { UpdateProjectDto, updateProjectSchema } from "./dto/update-project.dto";
import { UpdateProjectStatusDto, updateProjectStatusSchema } from "./dto/update-project-status.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @RequirePermissions("projects.view")
  @Get()
  findAll(
    @Query(new ZodValidationPipe(projectFilterSchema, "query")) filters: ProjectFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.findAll(filters, user);
  }

  @RequirePermissions("projects.create")
  @Post()
  create(
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.create(dto, user);
  }

  @RequirePermissions("projects.view")
  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkProjectSchema)) dto: BulkProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    this.assertBulkPermission(user, dto.action);
    return this.projectsService.bulk(dto, user);
  }

  @RequirePermissions("projects.view")
  @Get("deleted")
  findDeleted(
    @Query(new ZodValidationPipe(projectFilterSchema, "query")) filters: ProjectFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.findDeleted(filters, user);
  }

  @RequirePermissions("projects.view")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.findOne(id, user);
  }

  @RequirePermissions("projects.view")
  @Get(":id/overview-360")
  getOverview360(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getOverview360(id, user);
  }

  @RequirePermissions("projects.view")
  @Get(":id/timeline")
  getTimeline(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getTimeline(id, user);
  }

  @RequirePermissions("projects.view")
  @Get(":id/documents")
  getDocuments(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getDocuments(id, user);
  }

  @RequirePermissions("projects.view")
  @Get(":id/surveys")
  getSurveys(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getSurveys(id, user);
  }

  @RequirePermissions("projects.edit")
  @Post(":id/handovers")
  createHandover(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createProjectHandoverSchema)) dto: CreateProjectHandoverDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.createHandover(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @Patch(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.restore(id, user);
  }

  @RequirePermissions("projects.edit")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) dto: UpdateProjectStatusDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.updateStatus(id, dto, user);
  }

  @RequirePermissions("projects.delete")
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
