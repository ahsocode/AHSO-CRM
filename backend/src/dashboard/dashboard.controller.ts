import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("kpis")
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get("revenue-chart")
  getRevenueChart() {
    return this.dashboardService.getRevenueChart();
  }

  @Get("pipeline")
  getPipeline() {
    return this.dashboardService.getPipeline();
  }

  @Get("tasks-today")
  getTasksToday() {
    return this.dashboardService.getTasksToday();
  }

  @Get("recent-activity")
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}

