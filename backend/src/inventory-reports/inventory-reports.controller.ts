import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequireScope } from "../api-tokens/require-scope.decorator";
import type { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  InventoryValuationQuery,
  InvoiceDateWarningsQuery,
  ProjectCostQuery,
  ReceiptsWithoutInvoiceQuery,
  StockLedgerQuery,
  UnallocatedReceiptsQuery,
  inventoryValuationQuerySchema,
  invoiceDateWarningsQuerySchema,
  projectCostQuerySchema,
  receiptsWithoutInvoiceQuerySchema,
  stockLedgerQuerySchema,
  unallocatedReceiptsQuerySchema
} from "./inventory-reports.dto";
import { InventoryReportsService } from "./inventory-reports.service";
import { ReceiptReportsService } from "./receipt-reports.service";

/**
 * Read-only inventory reports for scripts/MCP. Humans need inventory.view; machine tokens need
 * the inventory.read scope. Prices are nulled without inventory.view_cost (machine tokens have it).
 */
@ApiTags("inventory-reports")
@Controller("inventory/reports")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireAnyPermissions("inventory.view", "inventory.read")
export class InventoryReportsController {
  constructor(
    private readonly reports: InventoryReportsService,
    private readonly receiptReports: ReceiptReportsService
  ) {}

  @ApiOperation({ summary: "GET /api/inventory/reports/stock-ledger — thẻ kho" })
  @RequireScope("inventory.read")
  @Get("stock-ledger")
  stockLedger(@Query(new ZodValidationPipe(stockLedgerQuerySchema, "query")) query: StockLedgerQuery, @CurrentUser() user: JwtUser) {
    return this.reports.stockLedger(query, user);
  }

  @ApiOperation({ summary: "GET /api/inventory/reports/inventory-valuation — giá trị tồn kho" })
  @RequireScope("inventory.read")
  @Get("inventory-valuation")
  inventoryValuation(
    @Query(new ZodValidationPipe(inventoryValuationQuerySchema, "query")) query: InventoryValuationQuery,
    @CurrentUser() user: JwtUser
  ) {
    return this.reports.inventoryValuation(query, user);
  }

  @ApiOperation({ summary: "GET /api/inventory/reports/project-cost — giá vốn dự án" })
  @RequireScope("inventory.read")
  @Get("project-cost")
  projectCost(@Query(new ZodValidationPipe(projectCostQuerySchema, "query")) query: ProjectCostQuery, @CurrentUser() user: JwtUser) {
    return this.reports.projectCost(query, user);
  }

  @ApiOperation({ summary: "GET /api/inventory/reports/unallocated-receipts — dòng nhập chưa phân bổ dự án" })
  @RequireScope("inventory.read")
  @Get("unallocated-receipts")
  unallocatedReceipts(
    @Query(new ZodValidationPipe(unallocatedReceiptsQuerySchema, "query")) query: UnallocatedReceiptsQuery,
    @CurrentUser() user: JwtUser
  ) {
    return this.receiptReports.unallocatedReceipts(query, user);
  }

  @ApiOperation({ summary: "GET /api/inventory/reports/receipts-without-invoice — phiếu nhập thiếu hóa đơn" })
  @RequireScope("inventory.read")
  @Get("receipts-without-invoice")
  receiptsWithoutInvoice(
    @Query(new ZodValidationPipe(receiptsWithoutInvoiceQuerySchema, "query")) query: ReceiptsWithoutInvoiceQuery,
    @CurrentUser() user: JwtUser
  ) {
    return this.receiptReports.receiptsWithoutInvoice(query, user);
  }

  @ApiOperation({ summary: "GET /api/inventory/reports/invoice-date-warnings — cảnh báo ngày hóa đơn mua sau ngày bán" })
  @RequireScope("inventory.read")
  @Get("invoice-date-warnings")
  invoiceDateWarnings(
    @Query(new ZodValidationPipe(invoiceDateWarningsQuerySchema, "query")) query: InvoiceDateWarningsQuery,
    @CurrentUser() user: JwtUser
  ) {
    return this.receiptReports.invoiceDateWarnings(query, user);
  }
}
