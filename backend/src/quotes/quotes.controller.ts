import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateQuoteDto, createQuoteSchema } from "./dto/create-quote.dto";
import { QuoteFilterDto, quoteFilterSchema } from "./dto/quote-filter.dto";
import { UpdateQuoteDto, updateQuoteSchema } from "./dto/update-quote.dto";
import {
  UpdateQuoteStatusDto,
  updateQuoteStatusSchema
} from "./dto/update-quote-status.dto";
import { QuotesService } from "./quotes.service";

@Controller("quotes")
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

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

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.duplicate(id, user);
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
