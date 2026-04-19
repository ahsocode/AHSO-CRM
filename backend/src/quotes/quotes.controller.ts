import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateQuoteDto, createQuoteSchema } from "./dto/create-quote.dto";
import { BulkQuoteDto, bulkQuoteSchema } from "./dto/bulk-quote.dto";
import { QuoteFilterDto, quoteFilterSchema } from "./dto/quote-filter.dto";
import { UpdateQuoteDto, updateQuoteSchema } from "./dto/update-quote.dto";
import {
  UpdateQuoteStatusDto,
  updateQuoteStatusSchema
} from "./dto/update-quote-status.dto";
import { QuotesPdfService } from "./quotes-pdf.service";
import { QuotesService } from "./quotes.service";

@Controller("quotes")
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotesPdfService: QuotesPdfService
  ) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(quoteFilterSchema, "query")) filters: QuoteFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.findAll(filters, user);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createQuoteSchema)) dto: CreateQuoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.create(dto, user);
  }

  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkQuoteSchema)) dto: BulkQuoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.bulk(dto, user);
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.duplicate(id, user);
  }

  @Post(":id/send")
  send(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.send(id, user);
  }

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

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateQuoteSchema)) dto: UpdateQuoteDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.update(id, dto, user);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateQuoteStatusSchema)) dto: UpdateQuoteStatusDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.quotesService.updateStatus(id, dto, user);
  }
}
