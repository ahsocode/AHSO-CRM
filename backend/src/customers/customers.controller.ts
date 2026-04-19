import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { CreateCustomerDto, createCustomerSchema } from "./dto/create-customer.dto";
import { BulkCustomerDto, bulkCustomerSchema } from "./dto/bulk-customer.dto";
import { CustomerFilterDto, customerFilterSchema } from "./dto/customer-filter.dto";
import { UpdateCustomerDto, updateCustomerSchema } from "./dto/update-customer.dto";
import { CustomersService } from "./customers.service";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(customerFilterSchema, "query")) filters: CustomerFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.customersService.findAll(filters, user);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkCustomerSchema)) dto: BulkCustomerDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.customersService.bulk(dto, user);
  }

  @Get(":id/stats")
  getStats(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.getStats(id, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.findOne(id, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.customersService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.remove(id, user);
  }
}
