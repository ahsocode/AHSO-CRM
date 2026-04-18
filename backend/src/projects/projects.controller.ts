import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { ProjectFilterDto, projectFilterSchema } from "./dto/project-filter.dto";
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

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.projectsService.findOne(id, user);
  }
}
