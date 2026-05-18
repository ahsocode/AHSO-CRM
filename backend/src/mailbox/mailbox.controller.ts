import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateEmailAccountDto, createEmailAccountSchema } from "./dto/create-email-account.dto";
import { GetMessagesDto, getMessagesSchema } from "./dto/get-messages.dto";
import { MarkReadDto, StarMessageDto, markReadSchema, starMessageSchema } from "./dto/message-actions.dto";
import { ReplyDto, replySchema } from "./dto/reply.dto";
import { SendEmailDto, sendEmailSchema } from "./dto/send-email.dto";
import { SetupPasswordDto, setupPasswordSchema } from "./dto/setup-password.dto";
import { MailboxService } from "./mailbox.service";

@ApiTags("mailbox")
@Controller("mailbox")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MailboxController {
  constructor(private readonly mailboxService: MailboxService) {}

  @ApiOperation({ summary: "POST /api/mailbox/account/setup" })
  @Post("account/setup")
  setupAccount(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(setupPasswordSchema)) dto: SetupPasswordDto
  ) {
    return this.mailboxService.setupAccount(user.sub, dto);
  }

  @ApiOperation({ summary: "GET /api/mailbox/folders" })
  @Get("folders")
  getFolders(@CurrentUser() user: JwtUser) {
    return this.mailboxService.getFolders(user.sub);
  }

  @ApiOperation({ summary: "GET /api/mailbox/messages" })
  @Get("messages")
  getMessages(
    @CurrentUser() user: JwtUser,
    @Query(new ZodValidationPipe(getMessagesSchema, "query")) query: GetMessagesDto
  ) {
    return this.mailboxService.getMessages(user.sub, query);
  }

  @ApiOperation({ summary: "GET /api/mailbox/messages/:id" })
  @Get("messages/:id")
  getMessage(@CurrentUser() user: JwtUser, @Param("id") messageId: string) {
    return this.mailboxService.getMessage(user.sub, messageId);
  }

  @ApiOperation({ summary: "POST /api/mailbox/send" })
  @Post("send")
  sendEmail(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(sendEmailSchema)) dto: SendEmailDto
  ) {
    return this.mailboxService.sendEmail(user.sub, dto);
  }

  @ApiOperation({ summary: "POST /api/mailbox/messages/:id/reply" })
  @Post("messages/:id/reply")
  replyEmail(
    @CurrentUser() user: JwtUser,
    @Param("id") messageId: string,
    @Body(new ZodValidationPipe(replySchema)) dto: ReplyDto
  ) {
    return this.mailboxService.replyEmail(user.sub, messageId, dto);
  }

  @ApiOperation({ summary: "PATCH /api/mailbox/messages/:id/read" })
  @Patch("messages/:id/read")
  markRead(
    @CurrentUser() user: JwtUser,
    @Param("id") messageId: string,
    @Body(new ZodValidationPipe(markReadSchema)) dto: MarkReadDto
  ) {
    return this.mailboxService.markRead(user.sub, messageId, dto.isRead);
  }

  @ApiOperation({ summary: "PATCH /api/mailbox/messages/:id/star" })
  @Patch("messages/:id/star")
  starMessage(
    @CurrentUser() user: JwtUser,
    @Param("id") messageId: string,
    @Body(new ZodValidationPipe(starMessageSchema)) dto: StarMessageDto
  ) {
    return this.mailboxService.starMessage(user.sub, messageId, dto.isStarred);
  }

  @ApiOperation({ summary: "DELETE /api/mailbox/messages/:id" })
  @Delete("messages/:id")
  deleteMessage(@CurrentUser() user: JwtUser, @Param("id") messageId: string) {
    return this.mailboxService.deleteMessage(user.sub, messageId);
  }

  @ApiOperation({ summary: "GET /api/mailbox/customer/:customerId" })
  @Get("customer/:customerId")
  getCustomerEmails(@CurrentUser() user: JwtUser, @Param("customerId") customerId: string) {
    return this.mailboxService.getCustomerEmails(user.sub, customerId);
  }

  @ApiOperation({ summary: "POST /api/mailbox/sync-me" })
  @Post("sync-me")
  syncMe(@CurrentUser() user: JwtUser) {
    return this.mailboxService.syncMyAccount(user.sub);
  }

  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "POST /api/mailbox/sync (admin: sync all accounts)" })
  @Post("sync")
  syncAll(@CurrentUser() user: JwtUser) {
    return this.mailboxService.syncAllAccounts(user);
  }

  @ApiOperation({ summary: "GET /api/mailbox/attachments/:id/download" })
  @Get("attachments/:id/download")
  async downloadAttachment(
    @CurrentUser() user: JwtUser,
    @Param("id") attachmentId: string,
    @Res() response: Response
  ) {
    const { buffer, filename, mimeType } = await this.mailboxService.downloadAttachment(user.sub, attachmentId);
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    response.send(buffer);
  }
}

@ApiTags("admin-email-accounts")
@Controller("admin/email-accounts")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminEmailAccountsController {
  constructor(private readonly mailboxService: MailboxService) {}

  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "POST /api/admin/email-accounts/bulk-create" })
  @Post("bulk-create")
  bulkCreate(@Query("imapHost") imapHost = "mail90168.maychuemail.com", @Query("smtpHost") smtpHost = "mail90168.maychuemail.com") {
    return this.mailboxService.bulkCreateAccounts(imapHost, smtpHost);
  }

  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "POST /api/admin/email-accounts" })
  @Post()
  create(@Body(new ZodValidationPipe(createEmailAccountSchema)) dto: CreateEmailAccountDto) {
    return this.mailboxService.createAccountByAdmin(dto);
  }

  @RequirePermissions("settings.view")
  @ApiOperation({ summary: "GET /api/admin/email-accounts" })
  @Get()
  findAll() {
    return this.mailboxService.listAccounts();
  }

  @RequirePermissions("settings.edit")
  @ApiOperation({ summary: "DELETE /api/admin/email-accounts/:id" })
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.mailboxService.deleteAccount(id);
  }
}
