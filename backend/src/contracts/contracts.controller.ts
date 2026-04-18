import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ContractFilterDto, contractFilterSchema } from "./dto/contract-filter.dto";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(contractFilterSchema, "query")) filters: ContractFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contractsService.findAll(filters, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.contractsService.findOne(id, user);
  }
}
