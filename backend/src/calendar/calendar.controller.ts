import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CalendarService } from "./calendar.service";
import { CalendarFilterDto, calendarFilterSchema } from "./dto/calendar-filter.dto";

@Controller("calendar")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @RequirePermissions("activities.view")
  @Get("events")
  findEvents(
    @Query(new ZodValidationPipe(calendarFilterSchema, "query")) filters: CalendarFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.calendarService.findEvents(filters, user);
  }
}
