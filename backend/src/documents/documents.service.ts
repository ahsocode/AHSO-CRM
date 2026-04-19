import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  InternalServerErrorException
} from "@nestjs/common";
import { DocumentType, Prisma } from "@prisma/client";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { join } from "path";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import { DocumentNumberService } from "./document-number.service";
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
    private readonly i18n: I18nService
  ) {}

  async onModuleInit() {
    // Ensure bundles are loaded first (I18nService also runs its own
    // onModuleInit, but ordering is not guaranteed across modules).
    await this.i18n.loadBundles();
    await this.registerPartials();
    this.registerGlobalHelpers();
    await this.loadCssBundle();
    this.initialized = true;
  }

  private registerGlobalHelpers() {
    registerHelpers(this.handlebars, this.i18n.getBundles());
  }

  private async registerPartials() {
    await Promise.all(
      PARTIAL_NAMES.map(async (name) => {
        const path = join(PARTIALS_DIR, `${name}.hbs`);
        try {
          const src = await readFile(path, "utf-8");
          this.handlebars.registerPartial(name, src);
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

  /**
   * Look up (or compile) a template. Throws a clear Not-Implemented error if
   * the `.hbs` file for the requested type/language is missing — this is the
   * expected signal until Phases 1-16 ship their template files.
   */
  private async getTemplate(
    entry: TemplateRegistryEntry,
    language: DocumentLanguage
  ): Promise<Handlebars.TemplateDelegate> {
    const cacheKey = `${entry.templateDir}:${language}`;
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const fileName = language === "vi-en" ? "vi-en.hbs" : "vi.hbs";
    const filePath = join(TEMPLATES_ROOT, entry.templateDir, fileName);
    let source: string;
    try {
      source = await readFile(filePath, "utf-8");
    } catch {
      throw new NotFoundException(
        `Template ${entry.type} (${language}) sẽ được triển khai ở Phase ${entry.phase}. File cần có: ${filePath}`
      );
    }

    const compiled = this.handlebars.compile(source, { noEscape: false });
    this.templateCache.set(cacheKey, compiled);
    return compiled;
  }

  private resolveLanguage(input: string | undefined): DocumentLanguage {
    return input === "vi-en" ? "vi-en" : "vi";
  }

  private wrapHtml(body: string, title: string): string {
    return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
${this.cssBundle}
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
  }

  /**
   * Render an HTML preview of a document. Returns HTML text ready to stream
   * as `Content-Type: text/html`.
   */
  async renderPreview(
    type: DocumentType,
    entityId: string,
    languageInput: string | undefined,
    user: JwtUser
  ): Promise<{ html: string }> {
    await this.ensureInitialized();
    const entry = getTemplateEntry(type);
    const language = this.resolveLanguage(languageInput);
    const base = await this.dataLoader.loadBaseContext(user, language);
    const loader = (this.dataLoader as unknown as Record<string, (id: string) => Promise<Record<string, unknown>>>)[
      entry.loaderMethod
    ];

    if (typeof loader !== "function") {
      throw new NotFoundException(
        `Không tìm thấy data loader cho ${type} (phương thức ${entry.loaderMethod}).`
      );
    }

    // For Phase 0 preview we still try the loader — if it throws
    // NotImplementedException (501), the controller will surface it to the
    // caller. Phase 0 only intends for the infrastructure to be wired.
    const entityData = await loader.call(this.dataLoader, entityId);

    const template = await this.getTemplate(entry, language);
    const context = {
      ...base,
      ...entityData,
      type,
      language,
      entityId
    };

    const body = template(context);
    const html = this.wrapHtml(body, String(entityData.title ?? type));
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
    const entry = getTemplateEntry(type);
    const language = this.resolveLanguage(languageInput);

    const base = await this.dataLoader.loadBaseContext(user, language);
    const loader = (this.dataLoader as unknown as Record<string, (id: string) => Promise<Record<string, unknown>>>)[
      entry.loaderMethod
    ];
    if (typeof loader !== "function") {
      throw new NotFoundException(
        `Không tìm thấy data loader cho ${type} (phương thức ${entry.loaderMethod}).`
      );
    }

    const entityData = await loader.call(this.dataLoader, entityId);
    const customerCode = this.extractCustomerCode(entityData);
    const customerId = this.extractCustomerId(entityData);

    const template = await this.getTemplate(entry, language);

    // Reserve a unique number using retry logic, inserting the Document row
    // on first success. Capture the rendered buffer in the closure.
    let capturedBuffer: Buffer | null = null;
    const createdNumber = await this.documentNumbers.reserveWithRetry(
      type,
      customerCode,
      1,
      async (number) => {
        const rendered = template({
          ...base,
          ...(extra ?? {}),
          ...entityData,
          type,
          language,
          entityId,
          docNumber: number
        });
        const html = this.wrapHtml(rendered, String(entityData.title ?? type));
        const pdfBuffer = await this.pdfRenderer.render(html);

        await this.prisma.document.create({
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

        // NOTE: PDF file persistence (pdfPath) is Phase 1+ — for Phase 0 we
        // just record renderedAt. Downloads re-render on demand.
        capturedBuffer = pdfBuffer;
      }
    );

    if (!capturedBuffer) {
      throw new InternalServerErrorException("Không tạo được buffer PDF.");
    }

    return {
      id: createdNumber,
      number: createdNumber,
      pdfUrl: `/api/documents/${type}/${entityId}/download?lang=${language}`,
      renderedAt: new Date().toISOString(),
      buffer: capturedBuffer as Buffer,
      filename: `${createdNumber}.pdf`
    };
  }

  /**
   * Download path: regenerates (for now) the PDF on demand. Until Phase 1+
   * persists the artifact, this is a live render.
   */
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
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.customerId) where.customerId = filters.customerId;

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

  private isKnownType(type: string): boolean {
    return Object.prototype.hasOwnProperty.call(TEMPLATE_REGISTRY, type);
  }

  private extractCustomerCode(data: Record<string, unknown>): string | null {
    const candidates = [
      (data.customer as Record<string, unknown> | undefined)?.code,
      data.customerCode
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) return c;
    }
    return null;
  }

  private extractCustomerId(data: Record<string, unknown>): string | null {
    const candidates = [
      (data.customer as Record<string, unknown> | undefined)?.id,
      data.customerId
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) return c;
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
