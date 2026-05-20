import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CreateMaterialCategoryDto,
  createMaterialCategorySchema,
  UpdateMaterialCategoryDto,
  updateMaterialCategorySchema,
} from "./dto/create-material-category.dto";
import { MaterialCategoriesService } from "./material-categories.service";

@ApiTags("material-categories")
@Controller("material-categories")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaterialCategoriesController {
  constructor(private readonly service: MaterialCategoriesService) {}

  @RequirePermissions("materials.view")
  @ApiOperation({ summary: "GET /api/material-categories" })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @RequirePermissions("materials.create")
  @ApiOperation({ summary: "POST /api/material-categories" })
  @Post()
  create(@Body(new ZodValidationPipe(createMaterialCategorySchema)) dto: CreateMaterialCategoryDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("materials.edit")
  @ApiOperation({ summary: "PATCH /api/material-categories/:id" })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMaterialCategorySchema)) dto: UpdateMaterialCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("materials.delete")
  @ApiOperation({ summary: "DELETE /api/material-categories/:id" })
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
