import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit
} from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { join } from "path";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import { DocumentLayoutRendererService } from "./document-layout-renderer.service";
import { DocumentNumberService } from "./document-number.service";
import { DocumentTemplateVariantsService } from "./document-template-variants.service";
import type { DocumentLanguage } from "./dto/document-type.enum";
import type { DocumentListFilterDto } from "./dto/render-document.dto";
import { registerHelpers } from "./helpers";
import { I18nService } from "./i18n.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { TEMPLATE_REGISTRY, TemplateRegistryEntry, getTemplateEntry } from "./template-registry";

const TEMPLATES_ROOT = join(__dirname, "templates");
const STYLES_DIR = join(TEMPLATES_ROOT, "styles");
const PARTIALS_DIR = join(TEMPLATES_ROOT, "_partials");

const PARTIAL_NAMES = [
  "header-modern",
  "header-classic",
  "footer-page",
  "signature-block",
  "company-info",
  "customer-info",
  "legal-footer"
] as const;

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentsService.name);
  private handlebars = Handlebars.create();
  private templateCache = new Map<string, Handlebars.TemplateDelegate>();
  private cssBundle = "";
  private initialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataLoader: DocumentDataLoaderService,
    private readonly documentNumbers: DocumentNumberService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly i18n: I18nService,
    private readonly templateVariants: DocumentTemplateVariantsService,
    private readonly layoutRenderer: DocumentLayoutRendererService
  ) {}

  async onModuleInit() {
    await this.i18n.loadBundles();
    await this.registerPartials();
    registerHelpers(this.handlebars, this.i18n.getBundles());
    await this.loadCssBundle();
    this.initialized = true;
  }

  private async registerPartials() {
    await Promise.all(
      PARTIAL_NAMES.map(async (name) => {
        const path = join(PARTIALS_DIR, `${name}.hbs`);
        try {
          const source = await readFile(path, "utf-8");
          this.handlebars.registerPartial(name, source);
        } catch (error) {
          this.logger.warn(`Missing partial ${name} at ${path}: ${(error as Error).message}`);
        }
      })
    );
  }

  private async loadCssBundle() {
    const parts: string[] = [];
    for (const name of ["base.css", "modern.css", "classic.css"]) {
      try {
        const css = await readFile(join(STYLES_DIR, name), "utf-8");
        parts.push(`/* ${name} */\n${css}`);
      } catch (error) {
        this.logger.warn(`Missing style ${name}: ${(error as Error).message}`);
      }
    }
    this.cssBundle = parts.join("\n\n");
  }

  private resolveLanguage(input: string | undefined): DocumentLanguage {
    return input === "vi-en" ? "vi-en" : "vi";
  }

  private resolveEditorLanguage(input: DocumentLanguage) {
    return input === "vi-en" ? "viEn" : "vi";
  }

  private wrapHtml(body: string, title: string, extraCss = ""): string {
    return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
${this.cssBundle}
${extraCss}
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
  }

  private async readDefaultTemplateSource(
    entry: TemplateRegistryEntry,
    language: DocumentLanguage
  ) {
    const fileName = language === "vi-en" ? "vi-en.hbs" : "vi.hbs";
    const filePath = join(TEMPLATES_ROOT, entry.templateDir, fileName);

    try {
      return await readFile(filePath, "utf-8");
    } catch {
      throw new NotFoundException(
        `Template ${entry.type} (${language}) sẽ được triển khai ở Phase ${entry.phase}. File cần có: ${filePath}`
      );
    }
  }

  private async getTemplate(
    entry: TemplateRegistryEntry,
    language: DocumentLanguage
  ): Promise<Handlebars.TemplateDelegate> {
    const cacheKey = `${entry.templateDir}:${language}`;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const source = await this.readDefaultTemplateSource(entry, language);
    const compiled = this.handlebars.compile(source, { noEscape: false });
    this.templateCache.set(cacheKey, compiled);
    return compiled;
  }

  async renderPreview(
    type: DocumentType,
    entityId: string,
    languageInput: string | undefined,
    user: JwtUser
  ): Promise<{ html: string }> {
    await this.ensureInitialized();
    const language = this.resolveLanguage(languageInput);
    const { context, title } = await this.buildRenderContext(type, entityId, language, user);
    const html = await this.renderHtml(type, language, context, title);

    return { html };
  }

  async renderPdf(
    type: DocumentType,
    entityId: string,
    languageInput: string | undefined,
    extra: Record<string, unknown> | undefined,
    user: JwtUser
  ) {
    await this.ensureInitialized();
    const language = this.resolveLanguage(languageInput);
    const { context, title, entry } = await this.buildRenderContext(type, entityId, language, user, extra);
    const customerCode = this.extractCustomerCode(context);
    const customerId = this.extractCustomerId(context);

    let capturedBuffer: Buffer | null = null;
    let createdDocumentId: string | null = null;
    let renderedAt: Date | null = null;

    const createdNumber = await this.documentNumbers.reserveWithRetry(
      type,
      customerCode,
      1,
      async (number) => {
        const html = await this.renderHtml(type, language, { ...context, docNumber: number }, title);
        const pdfBuffer = await this.pdfRenderer.render(html);

        const document = await this.prisma.document.create({
          data: {
            type,
            number,
            language,
            entityType: entry.entityType,
            entityId,
            customerId: customerId ?? undefined,
            createdById: user.sub,
            pdfPath: null,
            renderedAt: new Date()
          }
        });

        capturedBuffer = pdfBuffer;
        createdDocumentId = document.id;
        renderedAt = document.renderedAt ?? new Date();
      }
    );

    if (!capturedBuffer || !createdDocumentId || !renderedAt) {
      throw new InternalServerErrorException("Không tạo được buffer PDF.");
    }

    const finalRenderedAt: Date = renderedAt ?? new Date();

    return {
      id: createdDocumentId,
      number: createdNumber,
      pdfUrl: `/api/documents/${type}/${entityId}/download?lang=${language}`,
      renderedAt: finalRenderedAt.toISOString(),
      buffer: capturedBuffer,
      filename: `${createdNumber}.pdf`
    };
  }

  async renderDownload(
    type: DocumentType,
    entityId: string,
    languageInput: string | undefined,
    user: JwtUser
  ) {
    const result = await this.renderPdf(type, entityId, languageInput, undefined, user);
    return { buffer: result.buffer, filename: result.filename };
  }

  async list(filters: DocumentListFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {};
    if (filters.type && this.isKnownType(filters.type)) {
      where.type = filters.type as DocumentType;
    }
    if (filters.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, name: true, code: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      this.prisma.document.count({ where })
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  private async buildRenderContext(
    type: DocumentType,
    entityId: string,
    language: DocumentLanguage,
    user: JwtUser,
    extra?: Record<string, unknown>
  ) {
    const entry = getTemplateEntry(type);
    const base = await this.dataLoader.loadBaseContext(user, language);
    const loader = (
      this.dataLoader as unknown as Record<string, (id: string) => Promise<Record<string, unknown>>>
    )[entry.loaderMethod];

    if (typeof loader !== "function") {
      throw new NotFoundException(
        `Không tìm thấy data loader cho ${type} (phương thức ${entry.loaderMethod}).`
      );
    }

    const entityData = await loader.call(this.dataLoader, entityId);
    const context = {
      ...base,
      ...(extra ?? {}),
      ...entityData,
      type,
      language,
      entityId
    };

    return {
      entry,
      title: String(entityData.title ?? type),
      context
    };
  }

  private async renderHtml(
    type: DocumentType,
    language: DocumentLanguage,
    context: Record<string, unknown>,
    title: string
  ) {
    const activeVariant = await this.templateVariants.getActiveVariant(type);

    if (activeVariant) {
      const body = this.layoutRenderer.render(
        activeVariant.layoutJson,
        context,
        this.resolveEditorLanguage(language)
      );

      return this.wrapHtml(body, title, this.layoutRenderer.getCss());
    }

    const entry = getTemplateEntry(type);
    const template = await this.getTemplate(entry, language);
    const body = template(context);
    return this.wrapHtml(body, title);
  }

  private isKnownType(type: string): boolean {
    return Object.prototype.hasOwnProperty.call(TEMPLATE_REGISTRY, type);
  }

  private extractCustomerCode(data: Record<string, unknown>): string | null {
    const candidates = [
      (data.customer as Record<string, unknown> | undefined)?.code,
      data.customerCode
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return null;
  }

  private extractCustomerId(data: Record<string, unknown>): string | null {
    const candidates = [
      (data.customer as Record<string, unknown> | undefined)?.id,
      data.customerId
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return null;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.onModuleInit();
    }

    if (!this.initialized) {
      throw new InternalServerErrorException("Documents module chưa khởi tạo được.");
    }
  }
}
