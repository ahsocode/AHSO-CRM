import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  HttpException,
  UnprocessableEntityException
} from "@nestjs/common";
import { BusinessDocumentType, DocumentType, Prisma } from "@prisma/client";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { join } from "path";
import { JwtUser, isStaff } from "../auth/auth.types";
import { scopeCustomerWhereToUser } from "../common/scoping/customer-scope";
import { DOCUMENT_SOURCE_SCHEMAS, type MissingDocumentField } from "./document-requirements";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import { DocumentLayoutRendererService } from "./document-layout-renderer.service";
import { DocumentNumberService } from "./document-number.service";
import { DocumentTemplateVariantsService } from "./document-template-variants.service";
import { DOCUMENT_ENTITY_TYPES, type DocumentEntityType, type DocumentLanguage } from "./dto/document-type.enum";
import { RENDER_EXTRA_ALLOWED_KEYS, type DocumentListFilterDto } from "./dto/render-document.dto";
import { registerHelpers } from "./helpers";
import { buildPageMarginCss } from "./helpers/page-margin-css";
import { I18nService } from "./i18n.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { QuotationFlowHtmlRendererService } from "./quotation-flow-html-renderer.service";
import { TEMPLATE_REGISTRY, TemplateRegistryEntry, getTemplateEntry } from "./template-registry";
import { UploadService } from "../upload/upload.service";

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

/** Keep only allow-listed `extra` keys (see RENDER_EXTRA_ALLOWED_KEYS). */
export function pickAllowedExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  if (!extra || typeof extra !== "object") return picked;
  for (const key of RENDER_EXTRA_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(extra, key)) picked[key] = extra[key];
  }
  return picked;
}

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
    private readonly layoutRenderer: DocumentLayoutRendererService,
    private readonly quotationFlowRenderer: QuotationFlowHtmlRendererService,
    private readonly uploadService: UploadService
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

  private wrapHtml(body: string, title: string, extraCss = "", includeBaseCss = true): string {
    return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
${includeBaseCss ? this.cssBundle : ""}
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
    user: JwtUser,
    templateVariantId?: string
  ): Promise<{ html: string }> {
    await this.ensureInitialized();
    const language = this.resolveLanguage(languageInput);
    const { context, title } = await this.buildRenderContext(type, entityId, language, user);
    const html = await this.renderHtml(type, language, context, title, templateVariantId);

    return { html };
  }

  async renderPdf(
    type: DocumentType,
    entityId: string,
    languageInput: string | undefined,
    templateVariantId: string | undefined,
    extra: Record<string, unknown> | undefined,
    user: JwtUser,
    projectId?: string
  ) {
    await this.ensureInitialized();
    const language = this.resolveLanguage(languageInput);
    const { context, title, entry } = await this.buildRenderContext(type, entityId, language, user, extra);
    const customerCode = this.extractCustomerCode(context);
    const customerId = this.extractCustomerId(context);
    const renderEntityType = this.extractDocumentEntityType(context, entry.entityType);
    const renderEntityId = this.extractDocumentEntityId(context, entityId);
    const links = await this.resolveBusinessDocumentLinks(context, projectId, user);
    const generationKey = [type, renderEntityType, renderEntityId, language, links.projectId ?? ""].join(":");
    const previous = await this.prisma.document.findFirst({
      where: { type, entityType: renderEntityType, entityId: renderEntityId, language },
      orderBy: { version: "desc" }, select: { version: true }
    });
    const version = (previous?.version ?? 0) + 1;

    let createdDocumentNumber: string | null = null;
    let createdDocumentId: string | null = null;
    let createdPdfPath: string | null = null;
    let renderedAt: Date | null = null;

    await this.documentNumbers.reserveWithRetry(
      type,
      customerCode,
      version,
      async (number) => {
        const html = await this.renderHtml(
          type,
          language,
          { ...context, docNumber: number },
          title,
          templateVariantId
        );
        const pdfBuffer = await this.pdfRenderer.render(html);

        const createdAt = new Date();
        const document = await this.prisma.document.create({
          data: {
            type,
            number,
            version,
            language,
            entityType: renderEntityType,
            entityId: renderEntityId,
            customerId: customerId ?? undefined,
            createdById: user.sub,
            pdfPath: null,
            renderedAt: createdAt
          }
        });

        try {
          const storedPdf = await this.uploadService.saveBuffer(pdfBuffer, {
            originalName: `${number}.pdf`,
            mimeType: "application/pdf",
            subfolder: "documents"
          });

          // The stored PDF and its business-list entry become visible together.
          await this.prisma.$transaction(async tx => {
            await tx.document.update({ where: { id: document.id }, data: { pdfPath: storedPdf.url } });
            const data = {
              type: type === "SURVEY_REPORT" ? BusinessDocumentType.OTHER : type as BusinessDocumentType,
              source: "GENERATED" as const, status: "DRAFT" as const, title: entry.label,
              documentNo: number, documentDate: createdAt, fileUrl: storedPdf.url,
              filename: `${number}.pdf`, mimeType: "application/pdf", size: pdfBuffer.byteLength,
              ...links, generatedDocumentId: document.id,
              ...(type === "SURVEY_REPORT" ? { notes: "Báo cáo khảo sát (SURVEY_REPORT)" } : {})
            };
            await tx.businessDocument.upsert({
              where: { generationKey },
              create: { ...data, generationKey, createdById: user.sub },
              update: data
            });
          });

          createdDocumentNumber = number;
          createdDocumentId = document.id;
          createdPdfPath = storedPdf.url;
          renderedAt = createdAt;
        } catch (error) {
          await this.prisma.document.delete({
            where: { id: document.id }
          }).catch(() => undefined);
          throw error;
        }
      }
    );

    if (!createdDocumentNumber || !createdDocumentId || !createdPdfPath || !renderedAt) {
      throw new InternalServerErrorException("Không tạo được tài liệu PDF.");
    }

    const finalRenderedAt: Date = renderedAt ?? new Date();

    return {
      documentId: createdDocumentId,
      number: createdDocumentNumber,
      pdfPath: createdPdfPath,
      downloadUrl: `/api/documents/${createdDocumentId}/download`,
      renderedAt: finalRenderedAt.toISOString()
    };
  }

  async downloadDocument(documentId: string, user: JwtUser) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        ...this.buildDocumentAccessWhere(user)
      },
      select: {
        id: true,
        type: true,
        entityId: true,
        number: true,
        pdfPath: true
      }
    });

    if (!document) {
      throw new NotFoundException("Không tìm thấy tài liệu đã render.");
    }

    await this.assertEntityAccess(document.type, document.entityId, user);
    return this.readStoredDocument(document.number, document.pdfPath);
  }

  async downloadLatest(
    type: DocumentType,
    entityId: string,
    languageInput: string | undefined,
    user: JwtUser
  ) {
    const language = this.resolveLanguage(languageInput);
    const entry = getTemplateEntry(type);
    await this.assertEntityAccess(type, entityId, user);
    let canonicalEntityId = entityId;
    let canonicalEntityType = entry.entityType;
    if (type === "PAYMENT_RECEIPT") {
      const payment = await this.prisma.payment.findFirst({
        where: { OR: [{ id: entityId }, { contractId: entityId }] }, orderBy: [{ paidAt: "desc" }, { id: "desc" }], select: { id: true }
      });
      if (payment) { canonicalEntityId = payment.id; canonicalEntityType = "payment"; }
    }

    const document = await this.prisma.document.findFirst({
      where: {
        type,
        entityType: canonicalEntityType,
        entityId: canonicalEntityId,
        language,
        ...this.buildDocumentAccessWhere(user)
      },
      orderBy: [
        { renderedAt: "desc" },
        { createdAt: "desc" }
      ],
      select: {
        id: true,
        number: true,
        pdfPath: true
      }
    });

    if (!document) {
      throw new NotFoundException("Chưa render tài liệu cho đối tượng này.");
    }

    return this.readStoredDocument(document.number, document.pdfPath);
  }

  async list(filters: DocumentListFilterDto, user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const filterWhere: Prisma.DocumentWhereInput = {};
    if (filters.type && this.isKnownType(filters.type)) {
      filterWhere.type = filters.type as DocumentType;
    }
    if (filters.entityType) {
      filterWhere.entityType = filters.entityType;
    }
    if (filters.entityId) {
      filterWhere.entityId = filters.entityId;
    }
    if (filters.customerId) {
      filterWhere.customerId = filters.customerId;
    }
    const where = this.mergeWhere(filterWhere, this.buildDocumentAccessWhere(user));

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
    await this.assertEntityAccess(type, entityId, user);
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
    // Defence in depth for audit E-07 (the DTO already rejects unknown keys): only allow-listed
    // display flags survive, and they are spread FIRST so settings (company, bank, logo, policies,
    // signer) and loaded business data always win.
    const context = {
      ...pickAllowedExtra(extra),
      ...base,
      ...entityData,
      type,
      language,
      entityId,
      docNumber: "Bản xem trước"
    };
    await this.assertContextAccess(context, user);

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
    title: string,
    templateVariantId?: string
  ) {
    if (type === "QUOTATION") {
      const body = this.quotationFlowRenderer.renderBody(context, language);
      return this.wrapHtml(body, title, this.quotationFlowRenderer.getCss(), false);
    }

    const activeVariant = templateVariantId
      ? await this.templateVariants.getPublishedRuntimeVariant(templateVariantId, type)
      : await this.templateVariants.getActiveVariant(type);

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
    return this.wrapHtml(body, title, buildPageMarginCss(context, language));
  }

  private async readStoredDocument(number: string, pdfPath?: string | null) {
    if (!pdfPath) {
      throw new NotFoundException("Tài liệu này chưa có file PDF đã lưu.");
    }

    const storedPdf = await this.uploadService.readStoredFile(pdfPath);
    if (!storedPdf) {
      throw new NotFoundException("Không tìm thấy file PDF đã render.");
    }

    return {
      buffer: storedPdf.buffer,
      filename: `${number}.pdf`,
      mimeType: storedPdf.mimeType
    };
  }

  private isKnownType(type: string): boolean {
    return Object.prototype.hasOwnProperty.call(TEMPLATE_REGISTRY, type);
  }

  private buildDocumentAccessWhere(user: JwtUser): Prisma.DocumentWhereInput {
    if (!isStaff(user)) {
      return {};
    }

    return {
      customer: {
        ...scopeCustomerWhereToUser({ deletedAt: null }, user)
      }
    };
  }

  private mergeWhere(...parts: Prisma.DocumentWhereInput[]) {
    const activeParts = parts.filter((part) => Object.keys(part).length > 0);

    if (activeParts.length === 0) {
      return {};
    }

    if (activeParts.length === 1) {
      return activeParts[0];
    }

    return {
      AND: activeParts
    } satisfies Prisma.DocumentWhereInput;
  }

  private async assertContextAccess(context: Record<string, unknown>, user: JwtUser) {
    if (!isStaff(user)) {
      return;
    }

    const customerId = this.extractCustomerId(context);
    if (!customerId) {
      throw new NotFoundException("Không tìm thấy dữ liệu tài liệu trong phạm vi phụ trách.");
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...scopeCustomerWhereToUser({ deletedAt: null }, user)
      },
      select: { id: true }
    });

    if (!customer) {
      throw new NotFoundException("Không tìm thấy dữ liệu tài liệu trong phạm vi phụ trách.");
    }
  }

  private async resolveBusinessDocumentLinks(context: Record<string, unknown>, requestedProjectId: string | undefined, user: JwtUser) {
    const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
    const id = (value: unknown) => typeof value === "string" && value.length ? value : null;
    const project = record(context.project);
    const quote = record(context.quote ?? context.linkedQuote);
    const contract = record(context.contract);
    const payment = record(context.payment);
    const customerId = this.extractCustomerId(context);
    const actualProjectId = id(project.id) ?? id(contract.projectId) ?? id(quote.projectId) ?? id(payment.projectId);
    if (requestedProjectId && actualProjectId && requestedProjectId !== actualProjectId) throw new NotFoundException("Tài liệu không thuộc dự án này.");
    const projectId = actualProjectId ?? requestedProjectId ?? null;
    if (projectId) {
      const accessible = await this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null, customerId: customerId ?? undefined, customer: scopeCustomerWhereToUser({deletedAt: null}, user) }, select: { id: true }
      });
      if (!accessible) throw new NotFoundException("Không tìm thấy dự án trong phạm vi phụ trách.");
    }
    return { projectId, customerId, contractId: id(contract.id), quoteId: id(payment.quoteId) ?? id(quote.id), paymentId: id(payment.id) };
  }

  async getReadiness(type: DocumentType, entityId: string, user: JwtUser) {
    try {
      await this.buildRenderContext(type, entityId, "vi", user);
      return { readiness: "ready" as const, missingFields: [] as MissingDocumentField[] };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 422) {
        const response = error.getResponse() as { errors: MissingDocumentField[] };
        return { readiness: "missing" as const, missingFields: response.errors };
      }
      throw error;
    }
  }

  async getSourceData(type: DocumentType, entityId: string, user: JwtUser) {
    await this.assertEntityAccess(type, entityId, user);
    const record = await this.prisma.documentSourceData.findUnique({ where: { type_entityId: { type, entityId } } });
    return record?.data ?? {};
  }

  async saveSourceData(type: DocumentType, entityId: string, data: Record<string, unknown>, user: JwtUser) {
    await this.assertEntityAccess(type, entityId, user);
    const schema = DOCUMENT_SOURCE_SCHEMAS[type as keyof typeof DOCUMENT_SOURCE_SCHEMAS];
    if (!schema) throw new UnprocessableEntityException({ statusCode: 422, message: "Loại tài liệu này dùng dữ liệu nghiệp vụ có sẵn.", errors: [{ field: "type", message: "Không nhận dữ liệu nguồn bổ sung cho loại này." }] });
    const result = schema.safeParse(data);
    if (!result.success) throw new UnprocessableEntityException({ statusCode: 422, message: "Dữ liệu nguồn chưa đầy đủ.", errors: result.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })) });
    await this.prisma.documentSourceData.upsert({
      where: { type_entityId: { type, entityId } },
      create: { type, entityId, data: result.data as Prisma.InputJsonValue, recordedById: user.sub },
      update: { data: result.data as Prisma.InputJsonValue, recordedById: user.sub }
    });
    return this.getReadiness(type, entityId, user);
  }

  private async assertEntityAccess(type: DocumentType, entityId: string, user: JwtUser) {
    const entry = getTemplateEntry(type);
    const customerWhere = scopeCustomerWhereToUser({ deletedAt: null }, user);
    let entity: { id: string } | null = null;
    if (type === "PAYMENT_RECEIPT") {
      entity = await this.prisma.payment.findFirst({ where: { id: entityId, project: { deletedAt: null, customer: customerWhere } }, select: { id: true } });
      if (entity) return;
    }
    switch (entry.entityType) {
      case "customer": entity = await this.prisma.customer.findFirst({ where: { id: entityId, ...customerWhere }, select: { id: true } }); break;
      case "project": entity = await this.prisma.project.findFirst({ where: { id: entityId, deletedAt: null, customer: customerWhere }, select: { id: true } }); break;
      case "quote": entity = await this.prisma.quote.findFirst({ where: { id: entityId, deletedAt: null, project: { deletedAt: null, customer: customerWhere } }, select: { id: true } }); break;
      case "contract": entity = await this.prisma.contract.findFirst({ where: { id: entityId, deletedAt: null, project: { deletedAt: null, customer: customerWhere } }, select: { id: true } }); break;
    }
    if (!entity) throw new NotFoundException("Không tìm thấy dữ liệu tài liệu trong phạm vi phụ trách.");
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

  private extractDocumentEntityType(data: Record<string, unknown>, fallback: string) {
    const value = data.documentEntityType;
    return typeof value === "string" && DOCUMENT_ENTITY_TYPES.includes(value as DocumentEntityType) ? value : fallback;
  }

  private extractDocumentEntityId(data: Record<string, unknown>, fallback: string) {
    const value = data.documentEntityId;
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.onModuleInit();
    }

    if (!this.initialized) {
      throw new InternalServerErrorException("Module tài liệu chưa khởi tạo được.");
    }
  }
}
