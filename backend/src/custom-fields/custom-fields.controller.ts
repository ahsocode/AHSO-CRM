import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  CustomFieldDto,
  CustomFieldFilterDto,
  UpdateCustomFieldDto,
  customFieldFilterSchema,
  customFieldSchema,
  updateCustomFieldSchema
} from "./dto/custom-field.dto";
import { CustomFieldsService } from "./custom-fields.service";

@ApiTags("custom-fields")
@Controller("custom-fields")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @ApiOperation({ summary: "GET /api/custom-fields" })
  @Get()
  list(
    @Query(new ZodValidationPipe(customFieldFilterSchema, "query")) filters: CustomFieldFilterDto
  ) {
    return this.customFieldsService.findAll(filters);
  }

  @ApiOperation({ summary: "POST /api/custom-fields" })
  @Post()
  @Roles("ADMIN")
  create(@Body(new ZodValidationPipe(customFieldSchema)) dto: CustomFieldDto) {
    return this.customFieldsService.create(dto);
  }

  @ApiOperation({ summary: "PATCH /api/custom-fields/:id" })
  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomFieldSchema)) dto: UpdateCustomFieldDto
  ) {
    return this.customFieldsService.update(id, dto);
  }

  @ApiOperation({ summary: "DELETE /api/custom-fields/:id" })
  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.customFieldsService.remove(id);
  }
}
