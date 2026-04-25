import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAnyPermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SearchQueryDto, searchQuerySchema } from "./dto/search-query.dto";
import { SearchService } from "./search.service";

@ApiTags("search")
@Controller("search")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @RequireAnyPermissions("customers.view", "projects.view", "quotes.view", "contracts.view", "activities.view")
  @ApiOperation({ summary: "GET /api/search/global" })
  @Get("global")
  globalSearch(
    @Query(new ZodValidationPipe(searchQuerySchema, "query")) query: SearchQueryDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.searchService.globalSearch(query, user);
  }
}
