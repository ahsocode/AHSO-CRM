import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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

@Controller("activities")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @RequirePermissions("activities.view")
  @Get()
  findAll(
    @Query(new ZodValidationPipe(activityFilterSchema, "query")) filters: ActivityFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.activitiesService.findAll(filters, user);
  }

  @RequirePermissions("activities.create")
  @Post()
  create(@Body(new ZodValidationPipe(createActivitySchema)) dto: CreateActivityDto, @CurrentUser() user: JwtUser) {
    return this.activitiesService.create(dto, user);
  }

  @RequirePermissions("activities.view")
  @Get("deleted")
  findDeleted(
    @Query(new ZodValidationPipe(activityFilterSchema, "query")) filters: ActivityFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.activitiesService.findDeleted(filters, user);
  }

  @RequirePermissions("activities.view")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.findOne(id, user);
  }

  @RequirePermissions("activities.edit")
  @Patch(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.restore(id, user);
  }

  @RequirePermissions("activities.edit")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(updateActivitySchema)) dto: UpdateActivityDto, @CurrentUser() user: JwtUser) {
    return this.activitiesService.update(id, dto, user);
  }

  @RequirePermissions("activities.delete")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.remove(id, user);
  }
}
