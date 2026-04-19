import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import { DocumentType } from "@prisma/client";
import type { Response } from "express";
import { JwtUser } from "../auth/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
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
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * GET /documents
   * Paginated list of generated Document rows with optional filters.
   */
  @Get()
  list(
    @Query(new ZodValidationPipe(documentListFilterSchema, "query")) filters: DocumentListFilterDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.documentsService.list(filters, user);
  }

  /**
   * GET /documents/:type/:entityId/preview?lang=vi|vi-en
   * Returns rendered HTML (no PDF conversion). Used by the "Xem trước" action.
   */
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

  /**
   * POST /documents/:type/:entityId/render
   * Generates a PDF, persists a Document row, returns metadata.
   */
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
      id: result.id,
      number: result.number,
      pdfUrl: result.pdfUrl,
      renderedAt: result.renderedAt
    };
  }

  /**
   * GET /documents/:type/:entityId/download?lang=vi|vi-en
   * Streams the rendered PDF as an attachment.
   */
  @Get(":type/:entityId/download")
  async download(
    @Param("type") type: DocumentType,
    @Param("entityId") entityId: string,
    @Query(new ZodValidationPipe(previewQuerySchema, "query")) query: PreviewQueryDto,
    @CurrentUser() user: JwtUser,
    @Res() response: Response
  ) {
    const { buffer, filename } = await this.documentsService.renderDownload(
      type,
      entityId,
      query.lang,
      user
    );
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send(buffer);
  }
}
