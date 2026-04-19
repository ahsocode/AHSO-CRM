import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CustomReportQueryDto,
  ReportTemplateDto,
  UpdateReportTemplateDto,
  customReportQuerySchema,
  reportTemplateSchema,
  updateReportTemplateSchema
} from "./dto/custom-report.dto";
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

  @Get("customer-journey")
  getCustomerJourney(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getCustomerJourney(filters, user);
  }

  @Get("activity-heatmap")
  getActivityHeatmap(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getActivityHeatmap(filters, user);
  }

  @Get("funnel")
  getFunnel(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getFunnel(filters, user);
  }

  @Get("cohort")
  getCohort(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getCohort(filters, user);
  }

  @Post("custom/query")
  runCustomQuery(
    @Body(new ZodValidationPipe(customReportQuerySchema)) dto: CustomReportQueryDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.runCustomQuery(dto, user);
  }

  @Get("templates")
  getTemplates(@CurrentUser() user: JwtUser) {
    return this.reportsService.getTemplates(user);
  }

  @Post("templates")
  createTemplate(
    @Body(new ZodValidationPipe(reportTemplateSchema)) dto: ReportTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.createTemplate(dto, user);
  }

  @Patch("templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateReportTemplateSchema)) dto: UpdateReportTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.updateTemplate(id, dto, user);
  }

  @Delete("templates/:id")
  removeTemplate(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.reportsService.removeTemplate(id, user);
  }
}
