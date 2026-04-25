import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BusinessDocumentsService } from "./business-documents.service";
import {
  BusinessDocumentFileDto,
  CreateBusinessDocumentDto,
  SupersedeBusinessDocumentDto,
  UpdateBusinessDocumentDto,
  businessDocumentFileSchema,
  createBusinessDocumentSchema,
  supersedeBusinessDocumentSchema,
  updateBusinessDocumentSchema
} from "./dto/business-document.dto";

@Controller("business-documents")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BusinessDocumentsController {
  constructor(private readonly businessDocumentsService: BusinessDocumentsService) {}

  @RequirePermissions("documents.create")
  @Post()
  create(
    @Body(new ZodValidationPipe(createBusinessDocumentSchema)) dto: CreateBusinessDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.create(dto, user);
  }

  @RequirePermissions("documents.edit")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBusinessDocumentSchema)) dto: UpdateBusinessDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.update(id, dto, user);
  }

  @RequirePermissions("documents.view")
  @Get(":id/file")
  async downloadFile(
    @Param("id") id: string,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { buffer, filename, mimeType } = await this.businessDocumentsService.downloadFile(id, user);
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    response.send(buffer);
  }

  @RequirePermissions("documents.create")
  @Post(":id/file")
  @UseInterceptors(FileInterceptor("file"))
  uploadFile(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(businessDocumentFileSchema)) dto: BusinessDocumentFileDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.uploadFile(id, file, dto, user);
  }

  @RequirePermissions("documents.edit")
  @Post(":id/mark-signed")
  markSigned(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.businessDocumentsService.markSigned(id, user);
  }

  @RequirePermissions("documents.edit")
  @Post(":id/supersede")
  supersede(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(supersedeBusinessDocumentSchema)) dto: SupersedeBusinessDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.supersede(id, dto, user);
  }

  @RequirePermissions("documents.delete")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.businessDocumentsService.remove(id, user);
  }
}
