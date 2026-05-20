import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { InventoryBalanceFilterDto, inventoryBalanceFilterSchema } from "./dto/inventory-balance-filter.dto";
import { InventoryBalanceService } from "./inventory-balance.service";

@ApiTags("inventory")
@Controller("inventory")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryBalanceController {
  constructor(private readonly service: InventoryBalanceService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/inventory/balances" })
  @Get("balances")
  findBalances(
    @Query(new ZodValidationPipe(inventoryBalanceFilterSchema, "query")) filters: InventoryBalanceFilterDto,
  ) {
    return this.service.findBalances(filters);
  }

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/inventory/summary" })
  @Get("summary")
  getSummary() {
    return this.service.getSummary();
  }
}
