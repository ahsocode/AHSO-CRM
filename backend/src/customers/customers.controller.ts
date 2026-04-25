import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { hasPermission, JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateCustomerDto, createCustomerSchema } from "./dto/create-customer.dto";
import { BulkCustomerDto, bulkCustomerSchema } from "./dto/bulk-customer.dto";
import { CustomerFilterDto, customerFilterSchema } from "./dto/customer-filter.dto";
import { UpdateCustomerDto, updateCustomerSchema } from "./dto/update-customer.dto";
import { CustomersService } from "./customers.service";

@Controller("customers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequirePermissions("customers.view")
  @Get()
  findAll(
    @Query(new ZodValidationPipe(customerFilterSchema, "query")) filters: CustomerFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.customersService.findAll(filters, user);
  }

  @RequirePermissions("customers.create")
  @Post()
  create(@Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @RequirePermissions("customers.view")
  @Post("bulk")
  bulk(
    @Body(new ZodValidationPipe(bulkCustomerSchema)) dto: BulkCustomerDto,
    @CurrentUser() user: JwtUser
  ) {
    this.assertBulkPermission(user, dto.action);
    return this.customersService.bulk(dto, user);
  }

  @RequirePermissions("customers.view")
  @Get(":id/stats")
  getStats(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.getStats(id, user);
  }

  @RequirePermissions("customers.view")
  @Get("deleted")
  findDeleted(
    @Query(new ZodValidationPipe(customerFilterSchema, "query")) filters: CustomerFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.customersService.findDeleted(filters, user);
  }

  @RequirePermissions("customers.view")
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.findOne(id, user);
  }

  @RequirePermissions("customers.edit")
  @Patch(":id/restore")
  restore(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.restore(id, user);
  }

  @RequirePermissions("customers.edit")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.customersService.update(id, dto, user);
  }

  @RequirePermissions("customers.delete")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.customersService.remove(id, user);
  }

  private assertBulkPermission(user: JwtUser, action: BulkCustomerDto["action"]) {
    const permission =
      action === "assign"
        ? "customers.edit"
        : action === "delete"
          ? "customers.delete"
          : "customers.view";

    if (!hasPermission(user, permission)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
  }
}
