import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROLE_VALUES } from "src/common/constants/role.constants";
import { Roles } from "src/common/decorators/roles.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RequirePermissions } from "src/common/decorators/permissions.decorator";
import { ZodValidationPipe } from "src/common/pipes/zod-validation.pipe";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { RolesGuard } from "src/common/guards/roles.guard";
import { RolesService } from "./roles.service";
import { CreateRoleSchema, CreateRoleInput } from "./dto/create-role.dto";
import { UpdateRoleSchema, UpdateRoleInput } from "./dto/update-role.dto";

@ApiTags("roles")
@Controller("roles")
@ApiBearerAuth("bearer")
export class RolesController {
  constructor(private rolesService: RolesService) {}

  /**
   * GET /roles
   * List all roles with their permissions
   */
  // SECURITY: these two read endpoints had no guard at all — anyone on the
  // internet could list every role, its permissions and (via :id) the staff
  // name + email directory. Same access as the users page: ADMIN, MANAGER.
  @ApiOperation({ summary: "GET /api/roles" })
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  async findAll() {
    return this.rolesService.findAll();
  }

  /**
   * GET /roles/:id
   * Get a specific role with permissions and users
   */
  @ApiOperation({ summary: "GET /api/roles/:id" })
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  async findById(@Param("id") id: string) {
    return this.rolesService.findById(id);
  }

  /**
   * POST /roles
   * Create a new custom role (admin-only)
   */
  @ApiOperation({ summary: "POST /api/roles" })
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("roles.create")
  async create(
    @Body(new ZodValidationPipe(CreateRoleSchema))
    input: CreateRoleInput
  ) {
    return this.rolesService.create(input);
  }

  /**
   * PATCH /roles/:id
   * Update a role (admin-only, cannot update system roles)
   */
  @ApiOperation({ summary: "PATCH /api/roles/:id" })
  @Patch(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("roles.edit")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema))
    input: UpdateRoleInput
  ) {
    return this.rolesService.update(id, input);
  }

  /**
   * DELETE /roles/:id
   * Delete a role (admin-only, cannot delete system roles)
   */
  @ApiOperation({ summary: "DELETE /api/roles/:id" })
  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("roles.delete")
  async delete(@Param("id") id: string) {
    return this.rolesService.delete(id);
  }
}
