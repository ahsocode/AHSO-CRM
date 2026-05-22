import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PolicyItemType } from "@prisma/client";
import { RequirePermissions } from "src/common/decorators/permissions.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { ZodValidationPipe } from "src/common/pipes/zod-validation.pipe";
import {
  createPolicyItemSchema,
  updatePolicyItemSchema,
  type CreatePolicyItemDto,
  type UpdatePolicyItemDto
} from "./dto/policy-item.dto";
import { PolicyItemsService } from "./policy-items.service";

@ApiTags("policy-items")
@ApiBearerAuth()
@Controller("policy-items")
@UseGuards(JwtAuthGuard)
export class PolicyItemsController {
  constructor(private readonly service: PolicyItemsService) {}

  @Get()
  @ApiOperation({ summary: "List policy items, optionally filtered by type" })
  findAll(@Query("type") type?: PolicyItemType) {
    return this.service.findAll(type);
  }

  @Post()
  @ApiOperation({ summary: "Create a policy item" })
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.edit")
  create(@Body(new ZodValidationPipe(createPolicyItemSchema)) dto: CreatePolicyItemDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a policy item" })
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.edit")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePolicyItemSchema)) dto: UpdatePolicyItemDto
  ) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a policy item" })
  @UseGuards(PermissionsGuard)
  @RequirePermissions("settings.edit")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
