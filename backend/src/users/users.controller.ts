import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateUserDto, createUserSchema } from "./dto/create-user.dto";
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

  @Post()
  @Roles(ROLE_VALUES[0], ROLE_VALUES[1])
  create(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
    return this.usersService.create(dto);
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
