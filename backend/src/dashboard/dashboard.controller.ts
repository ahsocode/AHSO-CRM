import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions("reports.view")
  @Get("kpis")
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @RequirePermissions("reports.view")
  @Get("revenue-chart")
  getRevenueChart() {
    return this.dashboardService.getRevenueChart();
  }

  @RequirePermissions("reports.view")
  @Get("pipeline")
  getPipeline() {
    return this.dashboardService.getPipeline();
  }

  @RequirePermissions("reports.view")
  @Get("tasks-today")
  getTasksToday() {
    return this.dashboardService.getTasksToday();
  }

  @RequirePermissions("reports.view")
  @Get("recent-activity")
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
