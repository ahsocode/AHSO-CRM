import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ReportFilterDto, reportFilterSchema } from "./dto/report-filter.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  getOverview(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getOverview(filters, user);
  }

  @Get("revenue-trend")
  getRevenueTrend(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getRevenueTrend(filters, user);
  }

  @Get("status-breakdown")
  getStatusBreakdown(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getStatusBreakdown(filters, user);
  }

  @Get("top-customers")
  getTopCustomers(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getTopCustomers(filters, user);
  }
}
