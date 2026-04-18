import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateQuoteDto, createQuoteSchema } from "./dto/create-quote.dto";
import { QuoteFilterDto, quoteFilterSchema } from "./dto/quote-filter.dto";
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

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.quotesService.findOne(id, user);
  }
}
