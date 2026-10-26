import { invoiceDayEnd } from "../common/utils/invoice-date";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { decimalToNumber } from "../common/utils/decimal";
import { buildWhere as buildProjectWhere } from "../projects/project-where";
import { findLinesMissingMaterial, wouldCreateCycle } from "./bom-cost";
import { GraphLine, loadBomTotals, loadLineGraph, toFifoLine, totalsFromGraph } from "./bom-graph";
import type {
  BomLineInputDto,
  BomModelFilterDto,
  CreateProjectBomDto,
  ReplaceBomLinesDto,
  SaveAsModelDto,
  SuggestAllocationDto,
  UpdateBomDto
} from "./dto/bom.dto";
import { demandKey, expandBomDemand, suggestFifo } from "./fifo-suggest";
import { assertPermission, findAccessibleProject } from "./project-access";

type Mode = "view" | "edit";

const BOM_LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  kind: true,
  status: true,
  version: true,
  projectId: true,
  productId: true,
  sourceBomId: true,
  notes: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
  product: { select: { id: true, code: true, name: true, unit: true } },
  _count: { select: { lines: true } }
} as const;

type BomListRow = Prisma.BomGetPayload<{ select: typeof BOM_LIST_SELECT }>;

@Injectable()
export class BomsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Queries ────────────────────────────────────────────────────────────────

  async listProjectBoms(projectId: string, user: JwtUser) {
    await findAccessibleProject(this.prisma, projectId, user);
    const rows = await this.prisma.bom.findMany({
      where: { projectId, kind: "PROJECT", deletedAt: null },
      orderBy: [{ createdAt: "desc" }],
      select: BOM_LIST_SELECT
    });
    const items = await this.mapListRows(rows);
    return { items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
  }

  async listModels(filters: BomModelFilterDto, _user: JwtUser) {
    const where: Prisma.BomWhereInput = { kind: "MODEL", deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.productId) where.productId = filters.productId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
        { product: { name: { contains: filters.search, mode: "insensitive" } } },
        { product: { code: { contains: filters.search, mode: "insensitive" } } }
      ];
    }
    const rows = await this.prisma.bom.findMany({
      where,
      orderBy: [{ productId: "asc" }, { version: "desc" }],
      select: BOM_LIST_SELECT
    });

    let selected = rows;
    if (filters.latestOnly) {
      const seen = new Set<string>();
      selected = rows.filter((row) => {
        const key = row.productId ?? row.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    selected = selected.slice(0, filters.limit);

    const items = await this.mapListRows(selected);
    return { items, meta: { total: items.length, page: 1, limit: filters.limit, totalPages: 1 } };
  }

  async listModelVersions(productId: string, _user: JwtUser) {
    const rows = await this.prisma.bom.findMany({
      where: { kind: "MODEL", productId, deletedAt: null },
      orderBy: { version: "desc" },
      select: BOM_LIST_SELECT
    });
    const items = await this.mapListRows(rows);
    return { items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1 } };
  }

  async findOne(id: string, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "view");
    return this.buildDetail(id);
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async createProjectBom(projectId: string, dto: CreateProjectBomDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, projectId, user);

    let sourceLines: Array<Prisma.BomLineUncheckedCreateWithoutBomInput> = [];
    if (dto.sourceBomId) {
      const source = await this.findBomOrThrow(dto.sourceBomId, "Không tìm thấy BOM nguồn");
      await this.assertBomAccess(source, user, "view");
      if (source.kind === "MODEL") {
        if (source.status !== "APPROVED") {
          throw new BadRequestException("Chỉ có thể tạo từ mẫu máy đã duyệt");
        }
      }
      sourceLines = await this.copyLineData(source.id);
    }

    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateNextBomCode(tx);
      const created = await tx.bom.create({
        data: {
          code,
          name: dto.name,
          kind: "PROJECT",
          status: "DRAFT",
          projectId,
          notes: dto.notes,
          sourceBomId: dto.sourceBomId,
          createdById: user.sub,
          lines: { create: sourceLines }
        },
        select: { id: true, code: true }
      });
      return created;
    });
  }

  async update(id: string, dto: UpdateBomDto, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "edit");
    this.assertDraft(bom.status);

    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, id);
      await tx.bom.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {})
        }
      });
    });
    return this.buildDetail(id);
  }

  async replaceLines(id: string, dto: ReplaceBomLinesDto, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "edit");
    this.assertDraft(bom.status);

    await this.validateLines(bom.id, dto.lines);

    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, id);
      const keepIds = dto.lines.map((line) => line.id).filter((lineId): lineId is string => Boolean(lineId));
      await tx.bomLine.deleteMany({ where: { bomId: id, id: { notIn: keepIds } } });

      for (const [index, line] of dto.lines.entries()) {
        const data = this.toLineData(line, index);
        if (line.id) {
          await tx.bomLine.update({ where: { id: line.id }, data });
        } else {
          await tx.bomLine.create({ data: { ...data, bomId: id } });
        }
      }
      await tx.bom.update({ where: { id }, data: { updatedAt: new Date() } });
    });

    return this.buildDetail(id);
  }

  async approve(id: string, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "edit");
    this.assertDraft(bom.status);

    await this.prisma.$transaction(async (tx) => {
      await this.lockDraft(tx, id);
      const lines = await tx.bomLine.findMany({
        where: { bomId: id },
        select: { name: true, group: true, materialId: true, childBomId: true }
      });
      if (lines.length === 0) {
        throw new BadRequestException("BOM chưa có dòng nào, không thể duyệt");
      }
      if (bom.kind === "MODEL") {
        this.assertAllLinesHaveMaterial(lines);
      }

      await tx.bom.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
    });
    return this.buildDetail(id);
  }

  async archive(id: string, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "edit");
    if (bom.status === "ARCHIVED") {
      throw new BadRequestException("BOM đã ngừng dùng");
    }
    await this.prisma.bom.update({ where: { id }, data: { status: "ARCHIVED" } });
    return this.buildDetail(id);
  }

  async createNewVersion(id: string, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "edit");
    if (bom.status !== "APPROVED") {
      throw new BadRequestException("Chỉ có thể tạo phiên bản mới từ BOM đã duyệt");
    }
    const lines = await this.copyLineData(id);

    return this.prisma.$transaction(async (tx) => {
      let version: number;
      if (bom.kind === "MODEL" && bom.productId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bom_model_${bom.productId}`}))`;
        const max = await tx.bom.aggregate({ where: { productId: bom.productId }, _max: { version: true } });
        version = (max._max.version ?? 0) + 1;
      } else {
        const max = await tx.bom.aggregate({
          where: { OR: [{ id }, { sourceBomId: id }] },
          _max: { version: true }
        });
        version = (max._max.version ?? bom.version) + 1;
      }

      const code = await this.generateNextBomCode(tx);
      return tx.bom.create({
        data: {
          code,
          name: bom.name,
          kind: bom.kind,
          status: "DRAFT",
          version,
          projectId: bom.projectId,
          productId: bom.productId,
          sourceBomId: bom.id,
          notes: bom.notes,
          createdById: user.sub,
          lines: { create: lines }
        },
        select: { id: true, code: true, version: true }
      });
    });
  }

  async remove(id: string, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    await this.assertBomAccess(bom, user, "edit");

    const [quoteUses, allocationUses, childUses] = await Promise.all([
      this.prisma.quoteItem.count({ where: { bomId: id, quote: { deletedAt: null } } }),
      this.prisma.projectMaterialAllocationItem.count({
        where: { bomLine: { bomId: id }, allocation: { status: { not: "CANCELLED" } } }
      }),
      this.prisma.bomLine.count({ where: { childBomId: id, bom: { deletedAt: null } } })
    ]);
    if (quoteUses > 0) {
      throw new BadRequestException("BOM đang được gắn vào dòng báo giá, không thể xóa");
    }
    if (allocationUses > 0) {
      throw new BadRequestException("BOM đã có dòng phân bổ vật tư, không thể xóa");
    }
    if (childUses > 0) {
      throw new BadRequestException("BOM đang được dùng làm cụm con của BOM khác, không thể xóa");
    }

    await this.prisma.bom.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true, id };
  }

  // ─── Save as model (GĐ4) ────────────────────────────────────────────────────

  async saveAsModel(id: string, dto: SaveAsModelDto, user: JwtUser) {
    const bom = await this.findBomOrThrow(id);
    if (bom.kind !== "PROJECT") {
      throw new BadRequestException("Chỉ có thể lưu BOM dự án thành mẫu máy");
    }
    await this.assertBomAccess(bom, user, "view");
    assertPermission(user, "materials.edit");
    if (bom.status === "ARCHIVED") {
      throw new BadRequestException("BOM đã ngừng dùng, không thể lưu thành mẫu máy");
    }

    const sourceLines = await this.prisma.bomLine.findMany({
      where: { bomId: id },
      orderBy: { order: "asc" }
    });
    if (sourceLines.length === 0) {
      throw new BadRequestException("BOM chưa có dòng nào, không thể lưu thành mẫu máy");
    }
    this.assertAllLinesHaveMaterial(sourceLines);

    const actuals = dto.source === "ACTUAL" ? await this.loadActuals(sourceLines.map((line) => line.id)) : null;
    if (sourceLines.some((line) => line.childBomId && actuals?.has(line.id))) {
      throw new BadRequestException(
        "Chưa thể lưu mẫu thực tế cho cụm con đã phát sinh chi phí. Hãy chọn nguồn Dự toán hoặc bung cụm thành các dòng vật tư trước."
      );
    }
    const lineData = sourceLines.map((line, index): Prisma.BomLineUncheckedCreateWithoutBomInput => {
      let quantity: Decimal.Value = line.quantity;
      let estUnitCost: Decimal.Value = line.estUnitCost;
      const actual = actuals?.get(line.id);
      if (actual && !line.childBomId) {
        if (actual.quantity.gt(0)) {
          quantity = actual.quantity;
          estUnitCost = actual.amount.div(actual.quantity).toDecimalPlaces(0);
        } else if (new Decimal(line.quantity).gt(0)) {
          estUnitCost = actual.amount.div(line.quantity).toDecimalPlaces(0);
        }
      }
      return {
        order: index,
        group: line.group,
        materialId: line.materialId,
        childBomId: line.childBomId,
        name: line.name,
        specification: line.specification,
        unit: line.unit,
        quantity,
        estUnitCost,
        notes: line.notes
      };
    });

    return this.prisma.$transaction(async (tx) => {
      let productId = dto.productId;
      if (dto.newProduct) {
        const existing = await tx.material.findFirst({ where: { code: dto.newProduct.code } });
        if (existing) {
          throw new ConflictException(`Mã vật tư "${dto.newProduct.code}" đã tồn tại`);
        }
        const product = await tx.material.create({
          data: {
            code: dto.newProduct.code,
            name: dto.newProduct.name,
            unit: dto.newProduct.unit,
            kind: "PRODUCT"
          },
          select: { id: true }
        });
        productId = product.id;
      } else {
        const product = await tx.material.findFirst({ where: { id: productId, deletedAt: null } });
        if (!product) throw new NotFoundException("Không tìm thấy thành phẩm");
        if (product.kind !== "PRODUCT") {
          throw new BadRequestException("Vật tư được chọn không phải loại Thành phẩm (máy)");
        }
      }
      if (!productId) throw new BadRequestException("Thiếu thành phẩm");

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bom_model_${productId}`}))`;
      const max = await tx.bom.aggregate({ where: { productId }, _max: { version: true } });
      const code = await this.generateNextBomCode(tx);

      return tx.bom.create({
        data: {
          code,
          name: bom.name,
          kind: "MODEL",
          status: "DRAFT",
          version: (max._max.version ?? 0) + 1,
          productId,
          sourceBomId: bom.id,
          notes: bom.notes,
          createdById: user.sub,
          lines: { create: lineData }
        },
        select: { id: true, code: true, version: true, productId: true }
      });
    });
  }

  // ─── FIFO suggestion (GĐ2) ──────────────────────────────────────────────────

  async suggestAllocation(projectId: string, dto: SuggestAllocationDto, user: JwtUser) {
    await findAccessibleProject(this.prisma, projectId, user);
    if (dto.allocationId) {
      const draft = await this.prisma.projectMaterialAllocation.findFirst({
        where: { id: dto.allocationId, projectId, status: "DRAFT" }, select: { id: true }
      });
      if (!draft) throw new NotFoundException("Không tìm thấy đợt phân bổ nháp của dự án");
    }
    const bom = await this.prisma.bom.findFirst({
      where: { id: dto.bomId, projectId, kind: "PROJECT", deletedAt: null },
      select: { id: true, code: true, name: true }
    });
    if (!bom) throw new NotFoundException("Không tìm thấy BOM của dự án");

    const graph = await loadLineGraph(this.prisma, [bom.id]);
    const rootLines = graph.get(bom.id) ?? [];
    if (rootLines.length === 0) {
      throw new BadRequestException("BOM chưa có dòng nào để gợi ý phân bổ");
    }

    // R5 over the root and every sub-assembly that will be expanded
    const missing: string[] = [];
    for (const lines of graph.values()) {
      missing.push(...findLinesMissingMaterial(lines));
    }
    if (missing.length > 0) {
      throw new BadRequestException(this.missingMaterialMessage(missing));
    }

    const linesByBomId = new Map([...graph.entries()].map(([key, lines]) => [key, lines.map(toFifoLine)]));
    const expanded = expandBomDemand(linesByBomId.get(bom.id) ?? [], linesByBomId, dto.quantityMultiplier);
    const materialIds = [...new Set(expanded.stock.map((demand) => demand.materialId))];

    const [confirmedItems, lots, draftItems, costs] = await Promise.all([
      this.prisma.projectMaterialAllocationItem.findMany({
        where: { allocation: { projectId, status: "CONFIRMED" }, bomLineId: { not: null } },
        select: { bomLineId: true, materialId: true, quantity: true }
      }),
      this.prisma.stockLot.findMany({
        where: {
          materialId: { in: materialIds },
          remainingQuantity: { gt: 0 },
          purchaseInvoiceDate: { lte: invoiceDayEnd(dto.salesInvoiceDate) }
        },
        orderBy: [{ purchaseInvoiceDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          materialId: true,
          warehouseId: true,
          purchaseInvoiceDate: true,
          purchaseInvoiceNo: true,
          createdAt: true,
          remainingQuantity: true,
          unitPrice: true,
          warehouse: { select: { id: true, code: true, name: true } }
        }
      }),
      this.prisma.projectMaterialAllocationItem.findMany({
        where: {
          allocation: { status: "DRAFT", ...(dto.allocationId ? { id: { not: dto.allocationId } } : {}) },
          materialId: { in: materialIds }
        },
        select: { stockLotId: true, quantity: true }
      }),
      this.prisma.projectCost.findMany({
        where: { projectId, deletedAt: null, bomLineId: { not: null }, invoiceDate: { lte: invoiceDayEnd(dto.salesInvoiceDate) } },
        select: { bomLineId: true }
      })
    ]);

    const allocated = new Map<string, Decimal>();
    for (const item of confirmedItems) {
      if (!item.bomLineId) continue;
      const key = demandKey(item.bomLineId, item.materialId);
      allocated.set(key, (allocated.get(key) ?? new Decimal(0)).plus(item.quantity));
    }
    const reservedByLot = new Map<string, Decimal>();
    for (const item of draftItems) {
      reservedByLot.set(item.stockLotId, (reservedByLot.get(item.stockLotId) ?? new Decimal(0)).plus(item.quantity));
    }

    const result = suggestFifo({
      demands: expanded.stock,
      lots,
      salesInvoiceDate: dto.salesInvoiceDate,
      allocated,
      reservedByLot
    });

    const lotById = new Map(lots.map((lot) => [lot.id, lot]));
    const materialById = new Map(expanded.stock.map((demand) => [demand.materialId, demand]));
    const items = result.items.map((item) => {
      const lot = lotById.get(item.stockLotId);
      const demand = materialById.get(item.materialId);
      return {
        ...item,
        warehouse: lot?.warehouse ?? null,
        material: demand ? { id: demand.materialId, code: demand.code, name: demand.name, unit: demand.unit } : null,
        purchaseInvoiceDate: lot?.purchaseInvoiceDate ?? null,
        purchaseInvoiceNo: lot?.purchaseInvoiceNo ?? null
      };
    });

    const costedLineIds = new Set(costs.map((cost) => cost.bomLineId));
    const serviceLines = expanded.services.filter((service) => !costedLineIds.has(service.bomLineId));

    return {
      bomId: bom.id,
      bomCode: bom.code,
      salesInvoiceDate: dto.salesInvoiceDate,
      quantityMultiplier: dto.quantityMultiplier,
      items,
      shortages: result.shortages,
      serviceLines,
      totalAmount: items.reduce((sum, item) => sum + item.total, 0)
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async findBomOrThrow(id: string, message = "Không tìm thấy BOM") {
    const bom = await this.prisma.bom.findFirst({ where: { id, deletedAt: null } });
    if (!bom) throw new NotFoundException(message);
    return bom;
  }

  /** R11: project BOMs follow project permissions + STAFF scoping; MODEL BOMs follow material permissions. */
  private async assertBomAccess(bom: { kind: string; projectId: string | null }, user: JwtUser, mode: Mode) {
    if (bom.kind === "PROJECT") {
      assertPermission(user, mode === "view" ? "projects.view" : "projects.edit");
      if (!bom.projectId) throw new NotFoundException("Không tìm thấy dự án");
      const accessible = await this.prisma.project.findFirst({
        where: { ...buildProjectWhere({}, user), id: bom.projectId },
        select: { id: true }
      });
      if (!accessible) throw new NotFoundException("Không tìm thấy BOM");
      return;
    }
    assertPermission(user, mode === "view" ? "materials.view" : "materials.edit");
  }

  private assertDraft(status: string) {
    if (status !== "DRAFT") {
      throw new BadRequestException("BOM đã duyệt hoặc ngừng dùng, không thể sửa. Hãy tạo phiên bản mới.");
    }
  }

  private async lockDraft(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM "Bom" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.bom.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!current) throw new NotFoundException("Không tìm thấy BOM");
    this.assertDraft(current.status);
  }

  private missingMaterialMessage(names: string[]) {
    const unique = [...new Set(names)];
    return `Các dòng sau chưa gắn mã vật tư: ${unique.join(", ")}`;
  }

  private assertAllLinesHaveMaterial(
    lines: Array<{ name: string; group: GraphLine["group"]; materialId: string | null; childBomId: string | null }>
  ) {
    const missing = findLinesMissingMaterial(lines);
    if (missing.length > 0) {
      throw new BadRequestException(this.missingMaterialMessage(missing));
    }
  }

  private toLineData(line: BomLineInputDto, index: number): Prisma.BomLineUncheckedCreateWithoutBomInput {
    return {
      order: index,
      group: line.group,
      materialId: line.materialId ?? null,
      childBomId: line.childBomId ?? null,
      name: line.name,
      specification: line.specification ?? null,
      unit: line.unit ?? null,
      quantity: line.quantity,
      estUnitCost: Math.round(line.estUnitCost),
      notes: line.notes ?? null
    };
  }

  private async validateLines(bomId: string, lines: BomLineInputDto[]) {
    const ids = lines.map((line) => line.id).filter((id): id is string => Boolean(id));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Có dòng bị trùng mã dòng");
    }
    if (ids.length > 0) {
      const owned = await this.prisma.bomLine.count({ where: { id: { in: ids }, bomId } });
      if (owned !== ids.length) {
        throw new BadRequestException("Có dòng không thuộc BOM này");
      }
    }

    const materialIds = [...new Set(lines.map((line) => line.materialId).filter((id): id is string => Boolean(id)))];
    if (materialIds.length > 0) {
      const found = await this.prisma.material.count({ where: { id: { in: materialIds }, deletedAt: null } });
      if (found !== materialIds.length) {
        throw new BadRequestException("Có mã vật tư không tồn tại hoặc đã bị xóa");
      }
    }

    const childIds = [...new Set(lines.map((line) => line.childBomId).filter((id): id is string => Boolean(id)))];
    if (childIds.length > 0) {
      if (childIds.includes(bomId)) {
        throw new BadRequestException("BOM không thể chứa chính nó làm cụm con");
      }
      const children = await this.prisma.bom.findMany({
        where: { id: { in: childIds }, kind: "MODEL", status: "APPROVED", deletedAt: null },
        select: { id: true }
      });
      if (children.length !== childIds.length) {
        throw new BadRequestException("Cụm con phải là mẫu máy (BOM chuẩn) đã duyệt");
      }
      const graph = await loadLineGraph(this.prisma, childIds);
      const childrenOf = new Map<string, string[]>();
      for (const [key, graphLines] of graph.entries()) {
        childrenOf.set(
          key,
          graphLines.map((line) => line.childBomId).filter((id): id is string => Boolean(id))
        );
      }
      if (wouldCreateCycle(bomId, childIds, childrenOf)) {
        throw new BadRequestException("Cụm con tạo thành vòng lặp (A chứa B, B lại chứa A)");
      }
    }
  }

  private async copyLineData(bomId: string): Promise<Array<Prisma.BomLineUncheckedCreateWithoutBomInput>> {
    const lines = await this.prisma.bomLine.findMany({ where: { bomId }, orderBy: { order: "asc" } });
    return lines.map((line, index) => ({
      order: index,
      group: line.group,
      materialId: line.materialId,
      childBomId: line.childBomId,
      name: line.name,
      specification: line.specification,
      unit: line.unit,
      quantity: line.quantity,
      estUnitCost: line.estUnitCost,
      notes: line.notes
    }));
  }

  /** Actual quantity & amount per BOM line from CONFIRMED allocations and project costs. */
  private async loadActuals(lineIds: string[]) {
    const [items, costs] = await Promise.all([
      this.prisma.projectMaterialAllocationItem.findMany({
        where: { bomLineId: { in: lineIds }, allocation: { status: "CONFIRMED" } },
        select: { bomLineId: true, quantity: true, total: true }
      }),
      this.prisma.projectCost.findMany({
        where: { bomLineId: { in: lineIds }, deletedAt: null },
        select: { bomLineId: true, amount: true }
      })
    ]);
    const actuals = new Map<string, { quantity: Decimal; amount: Decimal }>();
    const bucket = (lineId: string) => {
      const existing = actuals.get(lineId) ?? { quantity: new Decimal(0), amount: new Decimal(0) };
      actuals.set(lineId, existing);
      return existing;
    };
    for (const item of items) {
      if (!item.bomLineId) continue;
      const entry = bucket(item.bomLineId);
      entry.quantity = entry.quantity.plus(item.quantity);
      entry.amount = entry.amount.plus(item.total);
    }
    for (const cost of costs) {
      if (!cost.bomLineId) continue;
      const entry = bucket(cost.bomLineId);
      entry.amount = entry.amount.plus(cost.amount);
    }
    return actuals;
  }

  /** R1: BOM-YYYY-NNN, generated under an advisory lock inside the caller's transaction. */
  async generateNextBomCode(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('bom_number'))`;
    const year = new Date().getFullYear();
    const prefix = `BOM-${year}-`;
    // createdAt (not code) so the sequence keeps working past 999
    const latest = await tx.bom.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { createdAt: "desc" },
      select: { code: true }
    });
    const seq = latest?.code.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  private async mapListRows(rows: BomListRow[]) {
    const totals = await loadBomTotals(this.prisma, rows.map((row) => row.id));
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      status: row.status,
      version: row.version,
      projectId: row.projectId,
      productId: row.productId,
      product: row.product,
      sourceBomId: row.sourceBomId,
      notes: row.notes,
      approvedAt: row.approvedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
      lineCount: row._count.lines,
      total: totals.get(row.id)?.total ?? 0
    }));
  }

  private async buildDetail(id: string) {
    const bom = await this.prisma.bom.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        status: true,
        version: true,
        projectId: true,
        productId: true,
        sourceBomId: true,
        notes: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, code: true, name: true, unit: true } },
        sourceBom: { select: { id: true, code: true, name: true, version: true } },
        lines: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            group: true,
            materialId: true,
            childBomId: true,
            name: true,
            specification: true,
            unit: true,
            quantity: true,
            estUnitCost: true,
            notes: true,
            material: { select: { id: true, code: true, name: true, unit: true, kind: true } },
            childBom: { select: { id: true, code: true, name: true, version: true } }
          }
        }
      }
    });
    if (!bom) throw new NotFoundException("Không tìm thấy BOM");

    const graph = await loadLineGraph(this.prisma, [id]);
    const totalsMap = totalsFromGraph(graph);
    const totals = totalsMap.get(id) ?? { total: 0, byGroup: [] };

    const lines = bom.lines.map((line) => {
      const childTotal = line.childBomId ? totalsMap.get(line.childBomId)?.total ?? 0 : null;
      const unitCost = childTotal ?? decimalToNumber(line.estUnitCost);
      return {
        id: line.id,
        order: line.order,
        group: line.group,
        materialId: line.materialId,
        childBomId: line.childBomId,
        name: line.name,
        specification: line.specification,
        unit: line.unit,
        quantity: decimalToNumber(line.quantity),
        estUnitCost: decimalToNumber(line.estUnitCost),
        notes: line.notes,
        material: line.material,
        childBom: line.childBom,
        childTotal,
        amount: new Decimal(line.quantity).mul(unitCost).toDecimalPlaces(0).toNumber()
      };
    });

    const { lines: _lines, ...info } = bom;
    return { ...info, lines, totals };
  }
}
