import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SearchQueryDto, searchQuerySchema } from "./dto/search-query.dto";
import { SearchService } from "./search.service";

@Controller("search")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("global")
  globalSearch(
    @Query(new ZodValidationPipe(searchQuerySchema, "query")) query: SearchQueryDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.searchService.globalSearch(query, user);
  }
}
