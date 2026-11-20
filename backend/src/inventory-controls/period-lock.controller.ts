import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "../auth/auth.types";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { SetPeriodLockDto, setPeriodLockSchema } from "./dto/set-period-lock.dto";
import { PeriodLockService } from "./period-lock.service";

/** ADMIN only. No @RequireScope: machine tokens can never read or change the lock. */
@ApiTags("inventory-controls")
@ApiBearerAuth("bearer")
@Controller("inventory/period-lock")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_VALUES[0])
export class PeriodLockController {
  constructor(private readonly service: PeriodLockService) {}

  @Get()
  @ApiOperation({ summary: "Xem ngày khóa sổ kho và lịch sử thay đổi" })
  get() {
    return this.service.get();
  }

  @Put()
  @ApiOperation({ summary: "Đặt/mở khóa sổ kho (bắt buộc lý do, chỉ ADMIN)" })
  set(
    @Body(new ZodValidationPipe(setPeriodLockSchema)) dto: SetPeriodLockDto,
    @CurrentUser() user: JwtUser,
    @Req() req: { ip?: string }
  ) {
    return this.service.set(dto, user, req.ip ?? null);
  }
}
