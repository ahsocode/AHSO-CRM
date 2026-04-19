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
import { Roles } from "src/common/decorators/roles.decorator";
import { ZodValidationPipe } from "src/common/pipes/zod-validation.pipe";
import { ROLE_VALUES } from "src/common/constants/role.constants";
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
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE_VALUES[0]) // ADMIN only
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
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE_VALUES[0]) // ADMIN only
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
  @UseGuards(JwtAuthGuard)
  @Roles(ROLE_VALUES[0]) // ADMIN only
  async delete(@Param("id") id: string) {
    return this.rolesService.delete(id);
  }
}
