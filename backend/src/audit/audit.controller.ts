import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuditService } from "./audit.service";
import { AuditLogFilterDto, auditLogFilterSchema } from "./dto/audit-log-filter.dto";

@ApiTags("audit")
@ApiBearerAuth("bearer")
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_VALUES[0])
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: "Lấy danh sách audit logs" })
  findAll(@Query(new ZodValidationPipe(auditLogFilterSchema, "query")) filters: AuditLogFilterDto) {
    return this.auditService.findAll(filters);
  }
}
