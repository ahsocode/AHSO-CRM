import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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

@Controller("custom-fields")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(customFieldFilterSchema, "query")) filters: CustomFieldFilterDto
  ) {
    return this.customFieldsService.findAll(filters);
  }

  @Post()
  @Roles("ADMIN")
  create(@Body(new ZodValidationPipe(customFieldSchema)) dto: CustomFieldDto) {
    return this.customFieldsService.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomFieldSchema)) dto: UpdateCustomFieldDto
  ) {
    return this.customFieldsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.customFieldsService.remove(id);
  }
}
