import { Controller, Get, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../common/decorators/public.decorator";
import type { ApplicationHealthStatus } from "./health.service";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Kiểm tra trạng thái ứng dụng, PostgreSQL và Redis" })
  async getStatus(@Res({ passthrough: true }) response: Response): Promise<ApplicationHealthStatus> {
    const status = await this.healthService.getStatus();

    if (status.status !== "up") {
      response.status(503);
    }

    return status;
  }
}
