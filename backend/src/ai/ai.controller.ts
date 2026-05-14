import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { AiService } from "./ai.service";
import { DraftEmailDto, draftEmailSchema } from "./dto/draft-email.dto";
import { ForecastRevenueDto, forecastRevenueSchema } from "./dto/forecast-revenue.dto";

@ApiTags("ai")
@ApiBearerAuth("bearer")
@Controller("ai")
@UseGuards(JwtAuthGuard, RolesGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("summarize/:customerId")
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  @ApiOperation({ summary: "Tóm tắt lịch sử tương tác của khách hàng bằng AI" })
  summarize(@Param("customerId") customerId: string, @CurrentUser() user: JwtUser) {
    return this.aiService.summarizeActivities(customerId, user);
  }

  @Post("customers/:customerId/summarize")
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  @ApiOperation({ summary: "Tóm tắt lịch sử tương tác của khách hàng bằng AI" })
  summarizeCustomer(@Param("customerId") customerId: string, @CurrentUser() user: JwtUser) {
    return this.aiService.summarizeActivities(customerId, user);
  }

  @Post("suggest-followup/:customerId")
  @ApiOperation({ summary: "Đề xuất bước follow-up tiếp theo bằng AI" })
  suggestFollowUp(@Param("customerId") customerId: string, @CurrentUser() user: JwtUser) {
    return this.aiService.suggestFollowUp(customerId, user);
  }

  @Post("draft-email")
  @ApiOperation({ summary: "Soạn email chăm sóc / bán hàng bằng AI" })
  draftEmail(
    @Body(new ZodValidationPipe(draftEmailSchema)) dto: DraftEmailDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.aiService.draftEmail(dto, user);
  }

  @Post("projects/:projectId/forecast")
  @ApiOperation({ summary: "Dự báo xác suất thắng và doanh thu kỳ vọng của dự án bằng AI" })
  forecastProject(@Param("projectId") projectId: string, @CurrentUser() user: JwtUser) {
    return this.aiService.forecastProject(projectId, user);
  }

  @Get("forecast-revenue")
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  @ApiOperation({ summary: "Dự báo doanh thu pipeline bằng AI" })
  forecastRevenue(
    @Query(new ZodValidationPipe(forecastRevenueSchema, "query")) query: ForecastRevenueDto
  ) {
    return this.aiService.forecastRevenue(query.months);
  }
}
