import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CommonAllocationsService } from "./common-allocations.service";
import { CostRecognitionService } from "./cost-recognition.service";
import {
  AssignCostDto,
  CancelSalesInvoiceDto,
  CommonAllocationDto,
  CommonAllocationFilterDto,
  CreateExpenseCostDto,
  CreateSalesInvoiceDto,
  ExpenseCostFilterDto,
  RecognizeCostDto,
  SalesInvoiceFilterDto,
  assignCostSchema,
  cancelSalesInvoiceSchema,
  commonAllocationFilterSchema,
  commonAllocationSchema,
  createExpenseCostSchema,
  createSalesInvoiceSchema,
  expenseCostFilterSchema,
  recognizeCostSchema,
  salesInvoiceFilterSchema
} from "./dto/project-finance.dto";
import { ExpenseCostsService } from "./expense-costs.service";
import { SalesInvoicesService } from "./sales-invoices.service";

@ApiTags("sales-invoices")
@Controller("sales-invoices")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesInvoicesController {
  constructor(private readonly service: SalesInvoicesService) {}

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/sales-invoices" })
  @Post()
  create(@Body(new ZodValidationPipe(createSalesInvoiceSchema)) dto: CreateSalesInvoiceDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/sales-invoices" })
  @Get()
  findAll(@Query(new ZodValidationPipe(salesInvoiceFilterSchema, "query")) filters: SalesInvoiceFilterDto, @CurrentUser() user: JwtUser) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/sales-invoices/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/sales-invoices/:id/cancel" })
  @Post(":id/cancel")
  cancel(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(cancelSalesInvoiceSchema)) dto: CancelSalesInvoiceDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.cancel(id, dto, user);
  }
}

@ApiTags("project-finance")
@Controller()
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectFinanceController {
  constructor(
    private readonly recognition: CostRecognitionService,
    private readonly expenses: ExpenseCostsService,
    private readonly allocations: CommonAllocationsService
  ) {}

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/projects/:id/recognize-cost" })
  @Post("projects/:id/recognize-cost")
  recognizeCost(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(recognizeCostSchema)) dto: RecognizeCostDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.recognition.recognize(id, dto, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "POST /api/project-finance/costs" })
  @Post("project-finance/costs")
  createCost(@Body(new ZodValidationPipe(createExpenseCostSchema)) dto: CreateExpenseCostDto, @CurrentUser() user: JwtUser) {
    return this.expenses.create(dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/project-finance/costs" })
  @Get("project-finance/costs")
  listCosts(@Query(new ZodValidationPipe(expenseCostFilterSchema, "query")) filters: ExpenseCostFilterDto, @CurrentUser() user: JwtUser) {
    return this.expenses.findAll(filters, user);
  }

  @RequirePermissions("projects.edit")
  @ApiOperation({ summary: "PATCH /api/project-finance/costs/:id/assign" })
  @Patch("project-finance/costs/:id/assign")
  assignCost(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(assignCostSchema)) dto: AssignCostDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.expenses.assign(id, dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "POST /api/project-finance/common-allocations (PREVIEW | CONFIRM)" })
  @Post("project-finance/common-allocations")
  allocate(@Body(new ZodValidationPipe(commonAllocationSchema)) dto: CommonAllocationDto, @CurrentUser() user: JwtUser) {
    return this.allocations.allocate(dto, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/project-finance/common-allocations" })
  @Get("project-finance/common-allocations")
  listAllocations(
    @Query(new ZodValidationPipe(commonAllocationFilterSchema, "query")) filters: CommonAllocationFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.allocations.findAll(filters, user);
  }

  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "GET /api/project-finance/common-allocations/:id" })
  @Get("project-finance/common-allocations/:id")
  allocationDetail(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.allocations.findOne(id, user);
  }
}
