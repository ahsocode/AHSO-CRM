import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtUser } from '../auth/auth.types';
import { CreateActivityDto, createActivitySchema } from './dto/create-activity.dto';
import { ActivityFilterDto, activityFilterSchema } from './dto/activity-filter.dto';
import { UpdateActivityDto, updateActivitySchema } from './dto/update-activity.dto';
import { ActivitiesService } from './activities.service';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(activityFilterSchema, 'query')) filters: ActivityFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.activitiesService.findAll(filters, user);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createActivitySchema)) dto: CreateActivityDto, @CurrentUser() user: JwtUser) {
    return this.activitiesService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateActivitySchema)) dto: UpdateActivityDto, @CurrentUser() user: JwtUser) {
    return this.activitiesService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.activitiesService.remove(id, user);
  }
}
