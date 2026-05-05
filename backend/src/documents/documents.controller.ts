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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DocumentType } from "@prisma/client";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
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
  runtimeDocumentTemplateQuerySchema,
  RuntimeDocumentTemplateQueryDto,
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

@ApiTags("documents")
@Controller("documents")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly templateVariants: DocumentTemplateVariantsService
  ) {}

  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "GET /api/documents/template-registry" })
  @Get("template-registry")
  async listTemplateRegistry() {
    return this.templateVariants.listRegistry();
  }

  @ApiOperation({ summary: "GET /api/documents/template-catalog/:type" })
  @Get("template-catalog/:type")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async getTemplateCatalog(
    @Param("type") type: DocumentType,
    @CurrentUser() user: JwtUser
  ) {
    return this.templateVariants.getCatalog(type, user);
  }

  @ApiOperation({ summary: "GET /api/documents/templates" })
  @Get("templates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async listTemplateVariants(
    @Query(new ZodValidationPipe(documentTemplateQuerySchema, "query"))
    query: DocumentTemplateQueryDto
  ) {
    return this.templateVariants.listVariants(query.type);
  }

  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "GET /api/documents/templates/available" })
  @Get("templates/available")
  async listRuntimeTemplateVariants(
    @Query(new ZodValidationPipe(runtimeDocumentTemplateQuerySchema, "query"))
    query: RuntimeDocumentTemplateQueryDto
  ) {
    return this.templateVariants.listRuntimeVariants(query.type);
  }

  @ApiOperation({ summary: "POST /api/documents/templates" })
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

  @ApiOperation({ summary: "GET /api/documents/templates/:id" })
  @Get("templates/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async getTemplateVariant(@Param("id") id: string) {
    return this.templateVariants.getVariant(id);
  }

  @ApiOperation({ summary: "PATCH /api/documents/templates/:id" })
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

  @ApiOperation({ summary: "POST /api/documents/templates/:id/submit-review" })
  @Post("templates/:id/submit-review")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async submitTemplateVariant(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.templateVariants.submitReview(id, user);
  }

  @ApiOperation({ summary: "POST /api/documents/templates/:id/approve" })
  @Post("templates/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async approveTemplateVariant(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.templateVariants.approve(id, user);
  }

  @ApiOperation({ summary: "POST /api/documents/templates/:id/set-active" })
  @Post("templates/:id/set-active")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async setActiveTemplateVariant(@Param("id") id: string) {
    return this.templateVariants.setActive(id);
  }

  @ApiOperation({ summary: "POST /api/documents/templates/:id/duplicate" })
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

  @ApiOperation({ summary: "DELETE /api/documents/templates/:id" })
  @Delete("templates/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async deleteTemplateVariant(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.templateVariants.deleteVariant(id, user);
  }

  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "GET /api/documents" })
  @Get()
  list(
    @Query(new ZodValidationPipe(documentListFilterSchema, "query")) filters: DocumentListFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.documentsService.list(filters, user);
  }

  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "GET /api/documents/:type/:entityId/preview" })
  @Get(":type/:entityId/preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  async preview(
    @Param("type") type: DocumentType,
    @Param("entityId") entityId: string,
    @Query(new ZodValidationPipe(previewQuerySchema, "query")) query: PreviewQueryDto,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { html } = await this.documentsService.renderPreview(
      type,
      entityId,
      query.lang,
      user,
      query.templateVariantId
    );
    response.send(html);
  }

  @RequirePermissions("documents.create")
  @ApiOperation({ summary: "POST /api/documents/:type/:entityId/render" })
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
      body.templateVariantId,
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

  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "GET /api/documents/:documentId/download" })
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

  @RequirePermissions("documents.view")
  @ApiOperation({ summary: "GET /api/documents/:type/:entityId/download" })
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
