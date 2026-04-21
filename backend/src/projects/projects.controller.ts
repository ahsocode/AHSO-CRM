import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { CreateProjectHandoverDto, createProjectHandoverSchema } from "./dto/create-project-handover.dto";
import { CreateProjectDto, createProjectSchema } from "./dto/create-project.dto";
import { BulkProjectDto, bulkProjectSchema } from "./dto/bulk-project.dto";
import { ProjectFilterDto, projectFilterSchema } from "./dto/project-filter.dto";
import { UpdateProjectDto, updateProjectSchema } from "./dto/update-project.dto";
import { UpdateProjectStatusDto, updateProjectStatusSchema } from "./dto/update-project-status.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(projectFilterSchema, "query")) filters: ProjectFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.findAll(filters, user);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.create(dto, user);
  }

  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkProjectSchema)) dto: BulkProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.bulk(dto, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.findOne(id, user);
  }

  @Get(":id/overview-360")
  getOverview360(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getOverview360(id, user);
  }

  @Get(":id/timeline")
  getTimeline(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getTimeline(id, user);
  }

  @Get(":id/documents")
  getDocuments(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getDocuments(id, user);
  }

  @Get(":id/surveys")
  getSurveys(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.getSurveys(id, user);
  }

  @Post(":id/handovers")
  createHandover(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createProjectHandoverSchema)) dto: CreateProjectHandoverDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.createHandover(id, dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProjectStatusSchema)) dto: UpdateProjectStatusDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.projectsService.updateStatus(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.remove(id, user);
  }
}
