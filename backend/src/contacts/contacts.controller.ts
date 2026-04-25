import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { ContactsService } from "./contacts.service";
import { CreateContactDto, createContactSchema } from "./dto/create-contact.dto";
import { UpdateContactDto, updateContactSchema } from "./dto/update-contact.dto";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @RequirePermissions("customers.view")
  @Get("customers/:customerId/contacts")
  findByCustomer(@Param("customerId") customerId: string, @CurrentUser() user: JwtUser) {
    return this.contactsService.findByCustomer(customerId, user);
  }

  @RequirePermissions("customers.edit")
  @Post("customers/:customerId/contacts")
  create(
    @Param("customerId") customerId: string,
    @Body(new ZodValidationPipe(createContactSchema)) dto: CreateContactDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contactsService.create(customerId, dto, user);
  }

  @RequirePermissions("customers.edit")
  @Patch("contacts/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) dto: UpdateContactDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contactsService.update(id, dto, user);
  }

  @RequirePermissions("customers.edit")
  @Delete("contacts/:id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.contactsService.remove(id, user);
  }
}
