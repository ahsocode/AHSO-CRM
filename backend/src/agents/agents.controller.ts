import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AgentsService } from "./agents.service";
import {
  CreateAgentDto,
  RunAgentDto,
  UpdateAgentDto,
  createAgentSchema,
  runAgentSchema,
  updateAgentSchema
} from "./dto/agent.dto";

@ApiTags("agents")
@ApiBearerAuth("bearer")
@Controller("agents")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @RequirePermissions("ai.use")
  @ApiOperation({ summary: "Lấy danh sách agent đang khả dụng" })
  list() {
    return this.agentsService.list();
  }

  @Post()
  @RequirePermissions("ai.manage_agents")
  @ApiOperation({ summary: "Tạo agent AI" })
  create(
    @Body(new ZodValidationPipe(createAgentSchema)) dto: CreateAgentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.agentsService.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("ai.manage_agents")
  @ApiOperation({ summary: "Cập nhật agent AI" })
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAgentSchema)) dto: UpdateAgentDto
  ) {
    return this.agentsService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("ai.manage_agents")
  @ApiOperation({ summary: "Tắt agent AI" })
  remove(@Param("id") id: string) {
    return this.agentsService.remove(id);
  }

  @Post(":id/run")
  @RequirePermissions("ai.use")
  @ApiOperation({ summary: "Chạy agent AI" })
  run(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(runAgentSchema)) dto: RunAgentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.agentsService.run(id, dto, user);
  }

  @Get("runs/:id")
  @RequirePermissions("ai.use")
  @ApiOperation({ summary: "Xem chi tiết agent run" })
  getRun(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.agentsService.getRun(id, user);
  }
}
