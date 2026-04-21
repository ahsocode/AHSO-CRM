import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
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
@UseGuards(JwtAuthGuard)
export class BusinessDocumentsController {
  constructor(private readonly businessDocumentsService: BusinessDocumentsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createBusinessDocumentSchema)) dto: CreateBusinessDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBusinessDocumentSchema)) dto: UpdateBusinessDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.update(id, dto, user);
  }

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

  @Post(":id/mark-signed")
  markSigned(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.businessDocumentsService.markSigned(id, user);
  }

  @Post(":id/supersede")
  supersede(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(supersedeBusinessDocumentSchema)) dto: SupersedeBusinessDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.businessDocumentsService.supersede(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.businessDocumentsService.remove(id, user);
  }
}
