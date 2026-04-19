import { Controller, Get, Param } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";

@Controller("permissions")
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  /**
   * GET /permissions
   * Get all permissions grouped by resource
   */
  @Get()
  async getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  /**
   * GET /permissions/resources
   * Get all available resources
   */
  @Get("resources")
  async getResources() {
    return this.permissionsService.getResources();
  }

  /**
   * GET /permissions/:resource
   * Get all actions for a specific resource
   */
  @Get(":resource")
  async getActionsForResource(@Param("resource") resource: string) {
    return this.permissionsService.getActionsForResource(resource);
  }
}
