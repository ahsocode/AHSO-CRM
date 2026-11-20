import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  BulkReceiptInvoicesDto,
  UpdateReceiptInvoiceDto,
  bulkReceiptInvoicesSchema,
  updateReceiptInvoiceSchema,
} from "./dto/invoice-fields.dto";
import { ReviewReceiptDto, reviewReceiptSchema } from "./dto/review-receipt.dto";
import { CreateStockReceiptDto, createStockReceiptSchema } from "./dto/create-stock-receipt.dto";
import { StockReceiptFilterDto, stockReceiptFilterSchema } from "./dto/stock-receipt-filter.dto";
import { UpdateStockReceiptDto, updateStockReceiptSchema } from "./dto/update-stock-receipt.dto";
import { StockReceiptsService } from "./stock-receipts.service";

@ApiTags("stock-receipts")
@Controller("stock-receipts")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockReceiptsController {
  constructor(private readonly service: StockReceiptsService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-receipts" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(stockReceiptFilterSchema, "query")) filters: StockReceiptFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.findAll(filters, user);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/stock-receipts/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions("inventory.create")
  @ApiOperation({ summary: "POST /api/stock-receipts" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createStockReceiptSchema)) dto: CreateStockReceiptDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  // Declared before the ":id" routes so "invoices" is never captured as an id.
  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "POST /api/stock-receipts/invoices/bulk — back-fill invoices, per-row result" })
  @Post("invoices/bulk")
  bulkInvoices(
    @Body(new ZodValidationPipe(bulkReceiptInvoicesSchema)) dto: BulkReceiptInvoicesDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.bulkUpdateInvoices(dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "PATCH /api/stock-receipts/:id/invoice — edit invoice info only (any non-cancelled status)" })
  @Patch(":id/invoice")
  updateInvoice(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateReceiptInvoiceSchema)) dto: UpdateReceiptInvoiceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.updateInvoice(id, dto, user);
  }

  @RequirePermissions("inventory.edit")
  @ApiOperation({ summary: "PATCH /api/stock-receipts/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateStockReceiptSchema)) dto: UpdateStockReceiptDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions("inventory.approve")
  @ApiOperation({ summary: "POST /api/stock-receipts/:id/confirm" })
  @Post(":id/confirm")
  confirm(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.confirm(id, user);
  }

  @RequirePermissions("inventory.approve")
  @ApiOperation({ summary: "POST /api/stock-receipts/:id/review — approve an auto-created receipt (PENDING_REVIEW -> REVIEWED)" })
  @Post(":id/review")
  review(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(reviewReceiptSchema)) dto: ReviewReceiptDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.review(id, dto.note, user);
  }

  @RequirePermissions("inventory.approve")
  @ApiOperation({ summary: "POST /api/stock-receipts/:id/cancel" })
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.cancel(id, user);
  }

  @RequirePermissions("inventory.delete")
  @ApiOperation({ summary: "DELETE /api/stock-receipts/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(id, user);
  }
}
