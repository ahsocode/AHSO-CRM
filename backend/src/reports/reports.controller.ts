import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
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

@ApiTags("reports")
@Controller("reports")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/overview" })
  @Get("overview")
  getOverview(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getOverview(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/revenue-trend" })
  @Get("revenue-trend")
  getRevenueTrend(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getRevenueTrend(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/status-breakdown" })
  @Get("status-breakdown")
  getStatusBreakdown(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getStatusBreakdown(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/top-customers" })
  @Get("top-customers")
  getTopCustomers(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getTopCustomers(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/customer-journey" })
  @Get("customer-journey")
  getCustomerJourney(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getCustomerJourney(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/activity-heatmap" })
  @Get("activity-heatmap")
  getActivityHeatmap(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getActivityHeatmap(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/funnel" })
  @Get("funnel")
  getFunnel(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getFunnel(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/cohort" })
  @Get("cohort")
  getCohort(
    @Query(new ZodValidationPipe(reportFilterSchema, "query")) filters: ReportFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.getCohort(filters, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "POST /api/reports/custom/query" })
  @Post("custom/query")
  runCustomQuery(
    @Body(new ZodValidationPipe(customReportQuerySchema)) dto: CustomReportQueryDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.runCustomQuery(dto, user);
  }

  @RequirePermissions("reports.view")
  @ApiOperation({ summary: "GET /api/reports/templates" })
  @Get("templates")
  getTemplates(@CurrentUser() user: JwtUser) {
    return this.reportsService.getTemplates(user);
  }

  @RequirePermissions("reports.create")
  @ApiOperation({ summary: "POST /api/reports/templates" })
  @Post("templates")
  createTemplate(
    @Body(new ZodValidationPipe(reportTemplateSchema)) dto: ReportTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.createTemplate(dto, user);
  }

  @RequirePermissions("reports.edit")
  @ApiOperation({ summary: "PATCH /api/reports/templates/:id" })
  @Patch("templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateReportTemplateSchema)) dto: UpdateReportTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.reportsService.updateTemplate(id, dto, user);
  }

  @RequirePermissions("reports.delete")
  @ApiOperation({ summary: "DELETE /api/reports/templates/:id" })
  @Delete("templates/:id")
  removeTemplate(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.reportsService.removeTemplate(id, user);
  }
}
