import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UpdateUserDto, updateUserSchema } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(":id")
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto
  ) {
    return this.usersService.update(id, dto);
  }
}
