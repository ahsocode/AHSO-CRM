import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PermissionsService } from "./permissions.service";

@ApiTags("permissions")
@Controller("permissions")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  /**
   * GET /permissions
   * Get all permissions grouped by resource
   */
  @RequirePermissions("roles.view")
  @ApiOperation({ summary: "GET /api/permissions" })
  @Get()
  async getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  /**
   * GET /permissions/resources
   * Get all available resources
   */
  @RequirePermissions("roles.view")
  @ApiOperation({ summary: "GET /api/permissions/resources" })
  @Get("resources")
  async getResources() {
    return this.permissionsService.getResources();
  }

  /**
   * GET /permissions/:resource
   * Get all actions for a specific resource
   */
  @RequirePermissions("roles.view")
  @ApiOperation({ summary: "GET /api/permissions/:resource" })
  @Get(":resource")
  async getActionsForResource(@Param("resource") resource: string) {
    return this.permissionsService.getActionsForResource(resource);
  }
}
