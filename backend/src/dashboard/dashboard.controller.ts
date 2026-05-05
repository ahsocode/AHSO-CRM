import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
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
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/revenue-chart" })
  @Get("revenue-chart")
  getRevenueChart() {
    return this.dashboardService.getRevenueChart();
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/dashboard/pipeline" })
  @Get("pipeline")
  getPipeline() {
    return this.dashboardService.getPipeline();
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
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
