import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { DocumentTemplateStatus, DocumentType, Prisma } from "@prisma/client";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { DocumentDataLoaderService } from "./document-data-loader.service";
import {
  buildDocumentTemplateCatalog,
  createDefaultLayoutForType
} from "./document-template-catalog";
import {
  createDocumentTemplateSchema,
  documentTemplateLayoutSchema
} from "./dto/document-template.dto";
import { TEMPLATE_REGISTRY } from "./template-registry";
import type {
  DocumentTemplateLayout,
  DocumentTemplateVariantPayload,
  TemplateCatalog,
  TemplateRegistrySummary,
  TemplateValidationIssue
} from "./document-template.types";
import { isTemplateEditorEnabled } from "./document-template.types";

const variantInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.DocumentTemplateVariantInclude;

type VariantRecord = Prisma.DocumentTemplateVariantGetPayload<{
  include: typeof variantInclude;
}>;

@Injectable()
export class DocumentTemplateVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataLoader: DocumentDataLoaderService
  ) {}

  listRegistry(): TemplateRegistrySummary[] {
    return Object.values(TEMPLATE_REGISTRY)
      .sort((left, right) => left.phase - right.phase)
      .map((entry) => ({
        type: entry.type,
        label: entry.label,
        templateDir: entry.templateDir,
        prefix: entry.prefix,
        style: entry.style,
        entityType: entry.entityType,
        phase: entry.phase,
        editorEnabled: isTemplateEditorEnabled(entry.type),
        usesVariantRuntime: isTemplateEditorEnabled(entry.type)
      }));
  }

  async listVariants(type?: DocumentType) {
    const variants = await this.prisma.documentTemplateVariant.findMany({
      where: type ? { type } : {},
      include: variantInclude,
      orderBy: [{ type: "asc" }, { isActive: "desc" }, { updatedAt: "desc" }]
    });

    return variants.map((variant) => this.serializeVariant(variant));
  }

  async getVariant(id: string) {
    const variant = await this.findVariantOrThrow(id);
    return this.serializeVariant(variant);
  }

  async getCatalog(type: DocumentType, user: JwtUser): Promise<TemplateCatalog> {
    this.assertEditorEnabled(type);

    const baseContext = await this.dataLoader.loadBaseContext(user, "vi");
    const catalog = buildDocumentTemplateCatalog(type);

    return {
      ...catalog,
      sampleData: {
        ...catalog.sampleData,
        company: {
          ...(catalog.sampleData.company as Record<string, unknown> | undefined),
          ...(baseContext.company as Record<string, unknown>)
        },
        policies: {
          ...(catalog.sampleData.policies as Record<string, unknown> | undefined),
          ...(baseContext.policies as Record<string, unknown>)
        },
        logo: baseContext.logo ?? catalog.sampleData.logo ?? null,
        generatedAt: baseContext.generatedAt.toISOString()
      }
    };
  }

  async createVariant(
    input: {
      type: DocumentType;
      name: string;
      basedOnVariantId?: string;
    },
    user: JwtUser
  ) {
    const parsed = createDocumentTemplateSchema.parse(input);
    this.assertEditorEnabled(parsed.type);

    let layout = createDefaultLayoutForType(parsed.type);
    let basedOnVariantId: string | null = null;

    if (parsed.basedOnVariantId) {
      const sourceVariant = await this.findVariantOrThrow(parsed.basedOnVariantId);
      if (sourceVariant.type !== parsed.type) {
        throw new BadRequestException("Variant gốc không cùng loại tài liệu.");
      }
      layout = this.parseLayout(sourceVariant.layoutJson);
      basedOnVariantId = sourceVariant.id;
    }

    const version = await this.getNextVersion(parsed.type);
    const created = await this.prisma.documentTemplateVariant.create({
      data: {
        type: parsed.type,
        name: parsed.name,
        status: "DRAFT",
        isActive: false,
        version,
        layoutJson: layout as unknown as Prisma.JsonObject,
        createdById: user.sub,
        basedOnVariantId
      },
      include: variantInclude
    });

    const catalog = await this.getCatalog(parsed.type, user);
    const validationIssues = this.validateLayout(layout, catalog.sampleData);

    return this.serializeVariant(created, validationIssues);
  }

  async updateVariant(
    id: string,
    input: {
      name?: string;
      layoutJson?: DocumentTemplateLayout;
    },
    user: JwtUser
  ) {
    const variant = await this.findVariantOrThrow(id);
    this.assertVariantEditable(variant);

    const layout = input.layoutJson ?? this.parseLayout(variant.layoutJson);
    const updated = await this.prisma.documentTemplateVariant.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        layoutJson: input.layoutJson
          ? (input.layoutJson as unknown as Prisma.JsonObject)
          : undefined
      },
      include: variantInclude
    });

    const catalog = await this.getCatalog(updated.type, user);
    const validationIssues = this.validateLayout(layout, catalog.sampleData);

    return this.serializeVariant(updated, validationIssues);
  }

  async submitReview(id: string, _user: JwtUser) {
    const variant = await this.findVariantOrThrow(id);
    this.assertVariantEditable(variant);

    const updated = await this.prisma.documentTemplateVariant.update({
      where: { id },
      data: {
        status: "PENDING_APPROVAL"
      },
      include: variantInclude
    });

    return this.serializeVariant(updated);
  }

  async approve(id: string, user: JwtUser) {
    const variant = await this.findVariantOrThrow(id);

    if (variant.status !== "PENDING_APPROVAL") {
      throw new BadRequestException("Chỉ variant đang chờ duyệt mới được publish.");
    }

    const catalog = await this.getCatalog(variant.type, user);
    const layout = this.parseLayout(variant.layoutJson);
    const validationIssues = this.validateLayout(layout, catalog.sampleData);
    const blockingIssues = validationIssues.filter((issue) => issue.severity === "error");
    if (blockingIssues.length > 0) {
      throw new BadRequestException(
        `Variant còn lỗi trước khi publish: ${blockingIssues[0].message}`
      );
    }

    const approved = await this.prisma.documentTemplateVariant.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        approvedById: user.sub,
        approvedAt: new Date()
      },
      include: variantInclude
    });

    return this.serializeVariant(approved, validationIssues);
  }

  async setActive(id: string) {
    const variant = await this.findVariantOrThrow(id);
    if (variant.status !== "PUBLISHED") {
      throw new BadRequestException("Chỉ variant đã publish mới có thể đặt active.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.documentTemplateVariant.updateMany({
        where: {
          type: variant.type,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      await tx.documentTemplateVariant.update({
        where: { id },
        data: {
          isActive: true
        }
      });
    });

    return this.getVariant(id);
  }

  async duplicate(id: string, user: JwtUser, name?: string) {
    const variant = await this.findVariantOrThrow(id);
    const version = await this.getNextVersion(variant.type);

    const duplicated = await this.prisma.documentTemplateVariant.create({
      data: {
        type: variant.type,
        name: name?.trim() || `${variant.name} copy`,
        status: "DRAFT",
        isActive: false,
        version,
        layoutJson: variant.layoutJson as Prisma.InputJsonValue,
        createdById: user.sub,
        basedOnVariantId: variant.id
      },
      include: variantInclude
    });

    const catalog = await this.getCatalog(variant.type, user);
    const validationIssues = this.validateLayout(
      this.parseLayout(duplicated.layoutJson),
      catalog.sampleData
    );

    return this.serializeVariant(duplicated, validationIssues);
  }

  async deleteVariant(id: string, _user: JwtUser) {
    const variant = await this.findVariantOrThrow(id);
    if (variant.isActive) {
      throw new BadRequestException("Không thể xóa variant đang active.");
    }
    if (variant.status === "PUBLISHED") {
      throw new BadRequestException("Không thể xóa variant đã publish. Hãy archive hoặc tạo bản mới.");
    }
    await this.prisma.documentTemplateVariant.delete({
      where: { id }
    });

    return {
      id,
      deleted: true
    };
  }

  async getActiveVariant(type: DocumentType) {
    if (!isTemplateEditorEnabled(type)) {
      return null;
    }

    const variant = await this.prisma.documentTemplateVariant.findFirst({
      where: {
        type,
        status: "PUBLISHED",
        isActive: true
      },
      include: variantInclude,
      orderBy: [{ updatedAt: "desc" }]
    });

    if (!variant) {
      return null;
    }

    return this.serializeVariant(variant);
  }

  validateLayout(
    layout: DocumentTemplateLayout,
    sampleData: Record<string, unknown>
  ): TemplateValidationIssue[] {
    const issues: TemplateValidationIssue[] = [];

    for (const [pageIndex, page] of layout.pages.entries()) {
      const visibleBoxes = page.boxes.filter((box) => box.visible !== false);

      for (const box of visibleBoxes) {
        const withinX =
          box.x >= layout.page.marginMm.left &&
          box.x + box.width <= layout.page.widthMm - layout.page.marginMm.right;
        const withinY =
          box.y >= layout.page.marginMm.top &&
          box.y + box.height <= layout.page.heightMm - layout.page.marginMm.bottom;

        if (!withinX || !withinY) {
          issues.push({
            boxId: box.id,
            code: "out_of_bounds",
            severity: "error",
            message: `Box "${box.id}" đang vượt ra ngoài vùng in ở trang ${pageIndex + 1}.`
          });
        }

        const overflowIssue = this.estimateOverflow(box, sampleData);
        if (overflowIssue) {
          issues.push(overflowIssue);
        }
      }

      for (let index = 0; index < visibleBoxes.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < visibleBoxes.length; otherIndex += 1) {
          const left = visibleBoxes[index];
          const right = visibleBoxes[otherIndex];
          if (this.boxesOverlap(left, right)) {
            issues.push({
              boxId: left.id,
              code: "overlap",
              severity: "error",
              message: `Box "${left.id}" đang chồng lấn với "${right.id}" ở trang ${pageIndex + 1}.`
            });
          }
        }
      }
    }

    return issues;
  }

  private estimateOverflow(
    box: DocumentTemplateLayout["pages"][number]["boxes"][number],
    sampleData: Record<string, unknown>
  ): TemplateValidationIssue | null {
    if (box.type === "image" || box.type === "signature_block") {
      return null;
    }

    const fontSize = box.style?.fontSize ?? 10;
    const padding = box.style?.padding ?? 2;
    const usableWidth = Math.max(10, box.width - padding * 2);
    const usableHeight = Math.max(8, box.height - padding * 2);
    const charsPerLine = Math.max(12, Math.floor((usableWidth * 2.2) / fontSize));
    const maxLines = Math.max(1, Math.floor((usableHeight * 2.6) / (fontSize * (box.style?.lineHeight ?? 1.4))));

    if (box.type === "text") {
      const rawText = box.content.text.vi;
      const interpolated = rawText.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, token) => {
        const value = this.getValueByToken(sampleData, token.trim());
        return value ? String(value) : "";
      });
      const estimatedLines = interpolated
        .split("\n")
        .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);

      if (estimatedLines > maxLines) {
        return {
          boxId: box.id,
          code: "overflow",
          severity: "error",
          message: `Box "${box.id}" có nguy cơ tràn nội dung. Hãy tăng chiều cao hoặc rút gọn text.`
        };
      }
    }

    if (box.type === "key_value_table") {
      if (box.content.rows.length > maxLines) {
        return {
          boxId: box.id,
          code: "overflow",
          severity: "error",
          message: `Box "${box.id}" không đủ chỗ cho toàn bộ dòng thông tin.`
        };
      }
    }

    if (box.type === "line_items_table") {
      const source = this.getValueByToken(sampleData, box.content.source);
      const itemCount = Array.isArray(source) ? source.length : 0;
      const estimatedRowHeight = Math.max(6, fontSize * 0.7);
      const maxRowCount = Math.max(1, Math.floor((usableHeight - estimatedRowHeight) / estimatedRowHeight));
      if (itemCount > maxRowCount) {
        return {
          boxId: box.id,
          code: "overflow",
          severity: "error",
          message: `Box "${box.id}" không đủ chỗ cho ${itemCount} dòng dữ liệu mẫu.`
        };
      }
    }

    return null;
  }

  private boxesOverlap(
    left: DocumentTemplateLayout["pages"][number]["boxes"][number],
    right: DocumentTemplateLayout["pages"][number]["boxes"][number]
  ) {
    return !(
      left.x + left.width <= right.x ||
      right.x + right.width <= left.x ||
      left.y + left.height <= right.y ||
      right.y + right.height <= left.y
    );
  }

  private getValueByToken(sampleData: Record<string, unknown>, tokenExpression: string) {
    const [path] = tokenExpression.split("|").map((segment) => segment.trim());
    return path.split(".").reduce<unknown>((current, segment) => {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const parsedIndex = Number(segment);
        return Number.isInteger(parsedIndex) ? current[parsedIndex] : undefined;
      }

      if (typeof current === "object") {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, sampleData);
  }

  private assertEditorEnabled(type: DocumentType) {
    if (!isTemplateEditorEnabled(type)) {
      throw new BadRequestException(
        `Loại tài liệu ${type} hiện vẫn dùng fallback HBS và chưa mở editor drag-drop ở phase này.`
      );
    }
  }

  private assertVariantEditable(variant: VariantRecord) {
    if (variant.status !== "DRAFT") {
      throw new BadRequestException("Chỉ variant ở trạng thái Draft mới được chỉnh sửa trực tiếp.");
    }
    if (variant.isActive) {
      throw new BadRequestException("Variant đang active không được sửa trực tiếp. Hãy duplicate để tạo draft mới.");
    }
  }

  private async getNextVersion(type: DocumentType) {
    const aggregate = await this.prisma.documentTemplateVariant.aggregate({
      where: { type },
      _max: {
        version: true
      }
    });

    return (aggregate._max.version ?? 0) + 1;
  }

  private parseLayout(value: Prisma.JsonValue): DocumentTemplateLayout {
    const parsed = documentTemplateLayoutSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException("layoutJson hiện tại không hợp lệ.");
    }
    return parsed.data;
  }

  private async findVariantOrThrow(id: string) {
    const variant = await this.prisma.documentTemplateVariant.findUnique({
      where: { id },
      include: variantInclude
    });

    if (!variant) {
      throw new NotFoundException("Không tìm thấy template variant.");
    }

    return variant;
  }

  private serializeVariant(
    variant: VariantRecord,
    validationIssues?: TemplateValidationIssue[]
  ): DocumentTemplateVariantPayload {
    return {
      id: variant.id,
      type: variant.type,
      name: variant.name,
      status: variant.status,
      isActive: variant.isActive,
      version: variant.version,
      createdById: variant.createdById,
      approvedById: variant.approvedById,
      approvedAt: variant.approvedAt?.toISOString() ?? null,
      basedOnVariantId: variant.basedOnVariantId,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
      layoutJson: this.parseLayout(variant.layoutJson),
      validationIssues,
      createdBy: variant.createdBy,
      approvedBy: variant.approvedBy
    };
  }
}
