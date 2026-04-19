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
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { RequirePermissions } from "src/common/decorators/permissions.decorator";
import { ZodValidationPipe } from "src/common/pipes/zod-validation.pipe";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { RolesService } from "./roles.service";
import { CreateRoleSchema, CreateRoleInput } from "./dto/create-role.dto";
import { UpdateRoleSchema, UpdateRoleInput } from "./dto/update-role.dto";

@Controller("roles")
export class RolesController {
  constructor(private rolesService: RolesService) {}

  /**
   * GET /roles
   * List all roles with their permissions
   */
  @Get()
  async findAll() {
    return this.rolesService.findAll();
  }

  /**
   * GET /roles/:id
   * Get a specific role with permissions and users
   */
  @Get(":id")
  async findById(@Param("id") id: string) {
    return this.rolesService.findById(id);
  }

  /**
   * POST /roles
   * Create a new custom role (admin-only)
   */
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
  @Delete(":id")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("roles.delete")
  async delete(@Param("id") id: string) {
    return this.rolesService.delete(id);
  }
}
