import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { hasPermission, JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateQuoteDto, createQuoteSchema, quoteTableColumnWidthsSchema } from "./dto/create-quote.dto";
import { BulkQuoteDto, bulkQuoteSchema } from "./dto/bulk-quote.dto";
import { QuoteFilterDto, quoteFilterSchema } from "./dto/quote-filter.dto";
import { UpdateQuoteDto, updateQuoteSchema } from "./dto/update-quote.dto";
import {
  UpdateQuoteStatusDto,
  updateQuoteStatusSchema
} from "./dto/update-quote-status.dto";
import { QuotesPdfService } from "./quotes-pdf.service";
import { QuotesService } from "./quotes.service";

@ApiTags("quotes")
@Controller("quotes")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotesPdfService: QuotesPdfService
  ) {}

  @RequirePermissions("quotes.view")
  @ApiOperation({ summary: "GET /api/quotes" })
  @Get()
  findAll(
    @Query(new ZodValidationPipe(quoteFilterSchema, "query")) filters: QuoteFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.findAll(filters, user);
  }

  @RequirePermissions("quotes.create")
  @ApiOperation({ summary: "POST /api/quotes" })
  @Post()
  create(
    @Body(new ZodValidationPipe(createQuoteSchema)) dto: CreateQuoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.create(dto, user);
  }

  @RequirePermissions("quotes.view")
  @ApiOperation({ summary: "POST /api/quotes/bulk" })
  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkQuoteSchema)) dto: BulkQuoteDto,
    @CurrentUser() user: JwtUser
  ) {
    this.assertBulkPermission(user, dto.action);
    return this.quotesService.bulk(dto, user);
  }

  @RequirePermissions("quotes.create")
  @ApiOperation({ summary: "POST /api/quotes/:id/duplicate" })
  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.duplicate(id, user);
  }

  @RequirePermissions("quotes.edit")
  @ApiOperation({ summary: "POST /api/quotes/:id/send" })
  @Post(":id/send")
  send(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.send(id, user);
  }

  @RequirePermissions("quotes.view")
  @ApiOperation({ summary: "GET /api/quotes/:id/pdf" })
  @Get(":id/pdf")
  async downloadPdf(
    @Param("id") id: string,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const pdf = await this.quotesPdfService.generatePdf(id, user);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${pdf.filename}"`);
    response.send(pdf.buffer);
  }

  @RequirePermissions("quotes.view")
  @ApiOperation({ summary: "GET /api/quotes/:id" })
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.findOne(id, user);
  }

  @RequirePermissions("quotes.edit")
  @ApiOperation({ summary: "PATCH /api/quotes/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateQuoteSchema)) dto: UpdateQuoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.update(id, dto, user);
  }

  @RequirePermissions("quotes.edit")
  @ApiOperation({ summary: "PATCH /api/quotes/:id/table-layout" })
  @Patch(":id/table-layout")
  updateTableLayout(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(quoteTableColumnWidthsSchema)) tableColumnWidths: Record<string, number>,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.updateTableLayout(id, tableColumnWidths as never, user);
  }

  @RequirePermissions("quotes.edit")
  @ApiOperation({ summary: "PATCH /api/quotes/:id/status" })
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateQuoteStatusSchema)) dto: UpdateQuoteStatusDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.updateStatus(id, dto, user);
  }

  @RequirePermissions("quotes.delete")
  @ApiOperation({ summary: "DELETE /api/quotes/:id" })
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.remove(id, user);
  }

  private assertBulkPermission(user: JwtUser, action: BulkQuoteDto["action"]) {
    const permission = action === "export" ? "quotes.view" : action === "delete" ? "quotes.delete" : "quotes.edit";

    if (!hasPermission(user, permission)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
  }
}
