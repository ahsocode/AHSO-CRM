import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtUser } from "../auth/auth.types";
import { ContactsService } from "./contacts.service";
import { CreateContactDto, createContactSchema } from "./dto/create-contact.dto";
import { UpdateContactDto, updateContactSchema } from "./dto/update-contact.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get("customers/:customerId/contacts")
  findByCustomer(@Param("customerId") customerId: string, @CurrentUser() user: JwtUser) {
    return this.contactsService.findByCustomer(customerId, user);
  }

  @Post("customers/:customerId/contacts")
  create(
    @Param("customerId") customerId: string,
    @Body(new ZodValidationPipe(createContactSchema)) dto: CreateContactDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contactsService.create(customerId, dto, user);
  }

  @Patch("contacts/:id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) dto: UpdateContactDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.contactsService.update(id, dto, user);
  }

  @Delete("contacts/:id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.contactsService.remove(id, user);
  }
}

