import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateActivityDto, createActivitySchema } from './dto/create-activity.dto';
import { ActivityFilterDto, activityFilterSchema } from './dto/activity-filter.dto';
import { UpdateActivityDto, updateActivitySchema } from './dto/update-activity.dto';
import { ActivitiesService } from './activities.service';

@ApiTags("activities")
@Controller("activities")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @RequirePermissions("activities.view")
  @ApiOperation({ summary: "GET /api/activities" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(activityFilterSchema, "query")) filters: ActivityFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.activitiesService.findAll(filters, user);
  }

  @RequirePermissions("activities.create")
  @ApiOperation({ summary: "POST /api/activities" })
  @Post()
  create(@Body(new ZodValidationPipe(createActivitySchema)) dto: CreateActivityDto, @CurrentUser() user: JwtUser) {
    return this.activitiesService.create(dto, user);
  }

  @RequirePermissions("activities.view")
  @ApiOperation({ summary: "GET /api/activities/deleted" })
  @Get("deleted")
  findDeleted(
    @Query(new ZodValidationPipe(activityFilterSchema, "query")) filters: ActivityFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.activitiesService.findDeleted(filters, user);
  }

  @RequirePermissions("activities.view")
  @ApiOperation({ summary: "GET /api/activities/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.findOne(id, user);
  }

  @RequirePermissions("activities.edit")
  @ApiOperation({ summary: "PATCH /api/activities/:id/restore" })
  @Patch(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.restore(id, user);
  }

  @RequirePermissions("activities.edit")
  @ApiOperation({ summary: "PATCH /api/activities/:id" })
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(updateActivitySchema)) dto: UpdateActivityDto, @CurrentUser() user: JwtUser) {
    return this.activitiesService.update(id, dto, user);
  }

  @RequirePermissions("activities.delete")
  @ApiOperation({ summary: "DELETE /api/activities/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.remove(id, user);
  }
}
