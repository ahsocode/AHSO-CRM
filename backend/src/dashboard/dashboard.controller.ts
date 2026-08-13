import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { DashboardFilterDto, dashboardFilterSchema } from "./dto/dashboard-filter.dto";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/kpis" })
  @Get("kpis")
  getKpis(
    @Query(new ZodValidationPipe(dashboardFilterSchema, "query")) filters: DashboardFilterDto
  ) {
    return this.dashboardService.getKpis(filters);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/revenue-chart" })
  @Get("revenue-chart")
  getRevenueChart(
    @Query(new ZodValidationPipe(dashboardFilterSchema, "query")) filters: DashboardFilterDto
  ) {
    return this.dashboardService.getRevenueChart(filters);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/pipeline" })
  @Get("pipeline")
  getPipeline(
    @Query(new ZodValidationPipe(dashboardFilterSchema, "query")) filters: DashboardFilterDto
  ) {
    return this.dashboardService.getPipeline(filters);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/tasks-today" })
  @Get("tasks-today")
  getTasksToday() {
    return this.dashboardService.getTasksToday();
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/recent-activity" })
  @Get("recent-activity")
  getRecentActivity(
    @Query(new ZodValidationPipe(dashboardFilterSchema, "query")) filters: DashboardFilterDto
  ) {
    return this.dashboardService.getRecentActivity(filters);
  }
}
