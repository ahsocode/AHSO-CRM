import { Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import type { MatchLineDto, SaveAliasDto } from "./dto/invoice-intake.dto";
import {
  actorUserId,
  cleanTaxCode,
  isUniqueViolation,
  nameSimilarity,
  normalizeItemCode,
  normalizeItemName
} from "./invoice-intake.utils";

type Db = PrismaClient | Prisma.TransactionClient;

export interface SupplierRef {
  id: string;
  name: string;
  taxCode: string | null;
  supplierType: "GOODS" | "SERVICE" | "EXPENSE" | "OTHER";
}

export interface AliasMatch {
  aliasId: string;
  materialId: string;
  matchedBy: "CODE" | "NAME";
  unitConversion: Decimal | null;
  supplierUnit: string | null;
}

export interface MatchCandidate {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  score: number;
  reasons: string[];
}

const MAX_CANDIDATES = 10;
const MIN_CANDIDATE_SCORE = 0.3;
const CANDIDATE_POOL_LIMIT = 5000;

@Injectable()
export class MaterialMatchingService {
  private readonly logger = new Logger(MaterialMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Finds the supplier by id or tax code. Never creates one (422 when missing). */
  async resolveSupplier(
    db: Db,
    input: { supplierId?: string; supplierTaxCode?: string }
  ): Promise<SupplierRef> {
    const select = { id: true, name: true, taxCode: true, supplierType: true } as const;
    if (input.supplierId) {
      const supplier = await db.supplier.findFirst({ where: { id: input.supplierId, deletedAt: null }, select });
      if (!supplier) throw new UnprocessableEntityException("Không tìm thấy nhà cung cấp");
      return supplier;
    }
    const code = cleanTaxCode(input.supplierTaxCode);
    if (!code) throw new UnprocessableEntityException("Cần supplierId hoặc MST nhà cung cấp");
    const candidates = await db.supplier.findMany({
      where: { taxCode: { contains: code }, deletedAt: null },
      select,
      take: 20
    });
    const exact = candidates.find((s) => cleanTaxCode(s.taxCode) === code);
    if (!exact) {
      throw new UnprocessableEntityException(
        `Chưa có nhà cung cấp với MST ${code}. Hãy tạo nhà cung cấp trước (hệ thống không tự tạo).`
      );
    }
    return exact;
  }

  /** Exact alias lookup: by supplier item code first, then by normalised name. Ambiguous names return null. */
  async findAlias(
    db: Db,
    supplierId: string,
    itemCode: string | undefined,
    itemName: string
  ): Promise<AliasMatch | null> {
    const toMatch = (
      alias: { id: string; materialId: string; unitConversion: Decimal | null; supplierUnit: string | null },
      matchedBy: "CODE" | "NAME"
    ): AliasMatch => ({
      aliasId: alias.id,
      materialId: alias.materialId,
      matchedBy,
      unitConversion: alias.unitConversion ? new Decimal(alias.unitConversion) : null,
      supplierUnit: alias.supplierUnit
    });

    if (itemCode) {
      const byCode = await db.materialAlias.findFirst({ where: { supplierId, supplierItemCode: itemCode } });
      if (byCode) return toMatch(byCode, "CODE");
    }
    const normalizedName = normalizeItemName(itemName);
    if (!normalizedName) return null;
    const byName = await db.materialAlias.findMany({
      where: { supplierId, normalizedName },
      orderBy: { createdAt: "desc" },
      take: 5
    });
    if (byName.length === 0) return null;
    const distinct = new Set(byName.map((a) => a.materialId));
    // Same name mapped to several materials is ambiguous: never auto-accept.
    if (distinct.size > 1) return null;
    return toMatch(byName[0], "NAME");
  }

  /** Fuzzy suggestions only; the caller must never auto-accept them. */
  async suggest(db: Db, supplierId: string, itemCode: string | undefined, itemName: string): Promise<MatchCandidate[]> {
    const [materials, links] = await Promise.all([
      db.material.findMany({
        where: { deletedAt: null, kind: { not: "SERVICE" } },
        select: { id: true, code: true, name: true, unit: true },
        take: CANDIDATE_POOL_LIMIT
      }),
      db.materialSupplier.findMany({ where: { supplierId }, select: { materialId: true, supplierCode: true } })
    ]);
    const linkByMaterial = new Map(links.map((l) => [l.materialId, l.supplierCode]));
    const codeKey = normalizeItemCode(itemCode);

    const out: MatchCandidate[] = [];
    for (const m of materials) {
      const reasons: string[] = [];
      let score = 0;
      const supplierCode = linkByMaterial.get(m.id);
      if (codeKey && (normalizeItemCode(m.code) === codeKey || normalizeItemCode(supplierCode) === codeKey)) {
        score = 1;
        reasons.push("Mã trùng");
      }
      const nameScore = nameSimilarity(itemName, m.name);
      if (nameScore > 0 && score < 1) {
        score = nameScore;
        reasons.push(`Tên giống ${Math.round(nameScore * 100)}%`);
      }
      if (linkByMaterial.has(m.id) && score > 0 && score < 1) {
        score = Math.min(0.99, score + 0.1);
        reasons.push("Đã liên kết với nhà cung cấp này");
      }
      if (score >= MIN_CANDIDATE_SCORE) {
        out.push({ materialId: m.id, code: m.code, name: m.name, unit: m.unit, score: Math.round(score * 100) / 100, reasons });
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
  }

  async matchLine(dto: MatchLineDto) {
    const supplier = await this.resolveSupplier(this.prisma, {
      supplierId: dto.supplierId,
      supplierTaxCode: dto.supplierTaxCode
    });
    const alias = await this.findAlias(this.prisma, supplier.id, dto.itemCode, dto.itemName);
    if (alias) {
      const material = await this.prisma.material.findFirst({
        where: { id: alias.materialId, deletedAt: null },
        select: { id: true, code: true, name: true, unit: true, kind: true, accountingClass: true }
      });
      if (material) {
        return {
          matched: material,
          alias: {
            id: alias.aliasId,
            matchedBy: alias.matchedBy,
            unitConversion: alias.unitConversion ? alias.unitConversion.toNumber() : null,
            supplierUnit: alias.supplierUnit
          },
          confidence: alias.matchedBy === "CODE" ? 1 : 0.95,
          candidates: [] as MatchCandidate[]
        };
      }
    }
    const candidates = await this.suggest(this.prisma, supplier.id, dto.itemCode, dto.itemName);
    return { matched: null, alias: null, confidence: 0, candidates };
  }

  /** Upsert by (supplier, code) when a code exists, else by (supplier, normalised name). */
  async saveAlias(dto: SaveAliasDto, user: JwtUser) {
    const supplier = await this.resolveSupplier(this.prisma, {
      supplierId: dto.supplierId,
      supplierTaxCode: dto.supplierTaxCode
    });
    const material = await this.prisma.material.findFirst({
      where: { id: dto.materialId, deletedAt: null },
      select: { id: true, code: true, name: true }
    });
    if (!material) throw new UnprocessableEntityException("Không tìm thấy vật tư");

    const normalizedName = normalizeItemName(dto.supplierItemName);
    if (!normalizedName) throw new UnprocessableEntityException("Tên hàng của NCC không hợp lệ");
    const data = {
      supplierItemName: dto.supplierItemName,
      normalizedName,
      supplierUnit: dto.supplierUnit ?? null,
      materialId: material.id,
      unitConversion: dto.unitConversion !== undefined ? new Decimal(String(dto.unitConversion)) : null
    };
    const where: Prisma.MaterialAliasWhereInput = dto.supplierItemCode
      ? { supplierId: supplier.id, supplierItemCode: dto.supplierItemCode }
      : { supplierId: supplier.id, supplierItemCode: null, normalizedName };

    const write = async () => {
      const existing = await this.prisma.materialAlias.findFirst({ where });
      if (existing) {
        const updated = await this.prisma.materialAlias.update({ where: { id: existing.id }, data });
        return { alias: updated, created: false, before: existing };
      }
      const created = await this.prisma.materialAlias.create({
        data: { ...data, supplierId: supplier.id, supplierItemCode: dto.supplierItemCode ?? null, createdById: actorUserId(user) }
      });
      return { alias: created, created: true, before: null };
    };

    let result: Awaited<ReturnType<typeof write>>;
    try {
      result = await write();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      result = await write(); // concurrent writer won: update their row
    }

    await this.recordAudit(user, result.created ? "alias.create" : "alias.update", result.alias.id, {
      before: result.before,
      after: result.alias,
      supplierId: supplier.id
    });
    return {
      id: result.alias.id,
      created: result.created,
      supplierId: supplier.id,
      supplierItemCode: result.alias.supplierItemCode,
      supplierItemName: result.alias.supplierItemName,
      normalizedName: result.alias.normalizedName,
      materialId: material.id,
      materialCode: material.code,
      unitConversion: result.alias.unitConversion ? new Decimal(result.alias.unitConversion).toNumber() : null
    };
  }

  /** Alias writes (also used when resolving a pending line inside a transaction). */
  async upsertAliasInTx(
    tx: Prisma.TransactionClient,
    input: {
      supplierId: string;
      supplierItemCode: string | null;
      supplierItemName: string;
      supplierUnit: string | null;
      materialId: string;
      unitConversion: Decimal | null;
      userId: string;
    }
  ) {
    const normalizedName = normalizeItemName(input.supplierItemName);
    const where: Prisma.MaterialAliasWhereInput = input.supplierItemCode
      ? { supplierId: input.supplierId, supplierItemCode: input.supplierItemCode }
      : { supplierId: input.supplierId, supplierItemCode: null, normalizedName };
    const existing = await tx.materialAlias.findFirst({ where });
    const data = {
      supplierItemName: input.supplierItemName,
      normalizedName,
      supplierUnit: input.supplierUnit,
      materialId: input.materialId,
      unitConversion: input.unitConversion
    };
    if (existing) return tx.materialAlias.update({ where: { id: existing.id }, data });
    return tx.materialAlias.create({
      data: { ...data, supplierId: input.supplierId, supplierItemCode: input.supplierItemCode, createdById: input.userId }
    });
  }

  private async recordAudit(user: JwtUser, action: string, resourceId: string, changes: unknown) {
    try {
      await this.audit.record({ userId: user.sub, action, resource: "material-aliases", resourceId, changes });
    } catch (error) {
      this.logger.warn(`Không ghi được audit ${action}: ${(error as Error).message}`);
    }
  }
}
