import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CostingConfigService } from "./costing-config.service";
import { SetCostingConfigDto, setCostingConfigSchema } from "./dto/costing-config.dto";

import { Roles } from "../common/decorators/roles.decorator";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { RolesGuard } from "../common/guards/roles.guard";
@ApiTags("inventory")
@Controller("inventory/costing-config")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class CostingConfigController {
  constructor(private readonly service: CostingConfigService) {}

  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "GET /api/inventory/costing-config - current method + history" })
  @Get()
  getConfig() {
    return this.service.getConfig();
  }

  // ADMIN only: also enforced in the service (isAdmin) so internal callers cannot bypass it.
  @Roles(ROLE_VALUES[0])
  @ApiOperation({ summary: "PUT /api/inventory/costing-config - change method from a later fiscal year" })
  @Put()
  setConfig(
    @Body(new ZodValidationPipe(setCostingConfigSchema)) dto: SetCostingConfigDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.setConfig(dto, user);
  }
}
