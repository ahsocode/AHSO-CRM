import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import { DocumentType } from "@prisma/client";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { DocumentTemplateVariantsService } from "./document-template-variants.service";
import {
  createDocumentTemplateSchema,
  CreateDocumentTemplateDto,
  documentTemplateQuerySchema,
  DocumentTemplateQueryDto,
  duplicateDocumentTemplateVariantSchema,
  DuplicateDocumentTemplateVariantDto,
  updateDocumentTemplateVariantSchema,
  UpdateDocumentTemplateVariantDto
} from "./dto/document-template.dto";
import {
  DocumentListFilterDto,
  documentListFilterSchema,
  previewQuerySchema,
  PreviewQueryDto,
  RenderDocumentDto,
  renderDocumentSchema
} from "./dto/render-document.dto";
import { DocumentsService } from "./documents.service";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly templateVariants: DocumentTemplateVariantsService
  ) {}

  @Get("template-registry")
  async listTemplateRegistry() {
    return this.templateVariants.listRegistry();
  }

  @Get("template-catalog/:type")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async getTemplateCatalog(
    @Param("type") type: DocumentType,
    @CurrentUser() user: JwtUser
  ) {
    return this.templateVariants.getCatalog(type, user);
  }

  @Get("templates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async listTemplateVariants(
    @Query(new ZodValidationPipe(documentTemplateQuerySchema, "query"))
    query: DocumentTemplateQueryDto
  ) {
    return this.templateVariants.listVariants(query.type);
  }

  @Post("templates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async createTemplateVariant(
    @Body(new ZodValidationPipe(createDocumentTemplateSchema))
    body: CreateDocumentTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.templateVariants.createVariant(body, user);
  }

  @Get("templates/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async getTemplateVariant(@Param("id") id: string) {
    return this.templateVariants.getVariant(id);
  }

  @Patch("templates/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async updateTemplateVariant(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateDocumentTemplateVariantSchema))
    body: UpdateDocumentTemplateVariantDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.templateVariants.updateVariant(id, body, user);
  }

  @Post("templates/:id/submit-review")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async submitTemplateVariant(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.templateVariants.submitReview(id, user);
  }

  @Post("templates/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async approveTemplateVariant(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.templateVariants.approve(id, user);
  }

  @Post("templates/:id/set-active")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async setActiveTemplateVariant(@Param("id") id: string) {
    return this.templateVariants.setActive(id);
  }

  @Post("templates/:id/duplicate")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async duplicateTemplateVariant(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(duplicateDocumentTemplateVariantSchema))
    body: DuplicateDocumentTemplateVariantDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.templateVariants.duplicate(id, user, body.name);
  }

  @Delete("templates/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async deleteTemplateVariant(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.templateVariants.deleteVariant(id, user);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(documentListFilterSchema, "query")) filters: DocumentListFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.documentsService.list(filters, user);
  }

  @Get(":type/:entityId/preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  async preview(
    @Param("type") type: DocumentType,
    @Param("entityId") entityId: string,
    @Query(new ZodValidationPipe(previewQuerySchema, "query")) query: PreviewQueryDto,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { html } = await this.documentsService.renderPreview(type, entityId, query.lang, user);
    response.send(html);
  }

  @Post(":type/:entityId/render")
  async render(
    @Param("type") type: DocumentType,
    @Param("entityId") entityId: string,
    @Body(new ZodValidationPipe(renderDocumentSchema)) body: RenderDocumentDto,
    @CurrentUser() user: JwtUser
  ) {
    const result = await this.documentsService.renderPdf(
      type,
      entityId,
      body.language,
      body.extra,
      user
    );
    return {
      documentId: result.documentId,
      number: result.number,
      downloadUrl: result.downloadUrl,
      renderedAt: result.renderedAt
    };
  }

  @Get(":documentId/download")
  async downloadById(
    @Param("documentId") documentId: string,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { buffer, filename, mimeType } = await this.documentsService.downloadDocument(documentId, user);
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send(buffer);
  }

  @Get(":type/:entityId/download")
  async download(
    @Param("type") type: DocumentType,
    @Param("entityId") entityId: string,
    @Query(new ZodValidationPipe(previewQuerySchema, "query")) query: PreviewQueryDto,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { buffer, filename, mimeType } = await this.documentsService.downloadLatest(
      type,
      entityId,
      query.lang,
      user
    );
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send(buffer);
  }
}
