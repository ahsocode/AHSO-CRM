import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PermissionsService } from "./permissions.service";

@Controller("permissions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  /**
   * GET /permissions
   * Get all permissions grouped by resource
   */
  @RequirePermissions("roles.view")
  @Get()
  async getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  /**
   * GET /permissions/resources
   * Get all available resources
   */
  @RequirePermissions("roles.view")
  @Get("resources")
  async getResources() {
    return this.permissionsService.getResources();
  }

  /**
   * GET /permissions/:resource
   * Get all actions for a specific resource
   */
  @RequirePermissions("roles.view")
  @Get(":resource")
  async getActionsForResource(@Param("resource") resource: string) {
    return this.permissionsService.getActionsForResource(resource);
  }
}
