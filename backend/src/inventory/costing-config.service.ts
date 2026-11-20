import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { JwtUser, isAdmin } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { SetCostingConfigDto } from "./dto/costing-config.dto";
import { getCostingMethod } from "./inventory-controls";

const COSTING_CONFIG_LOCK = "inventory_costing_config";

/**
 * Inventory costing method (AVERAGE | FIFO), locked per fiscal year (calendar year).
 * The method in force for a document = getCostingMethod(db, documentDate).
 */
@Injectable()
export class CostingConfigService {
  private readonly logger = new Logger(CostingConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async getConfig() {
    const now = new Date();
    const [method, history] = await Promise.all([
      getCostingMethod(this.prisma, now),
      this.prisma.inventoryCostingConfig.findMany({ orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] }),
    ]);
    const inForce = history.find((row) => row.effectiveFrom.getTime() <= now.getTime()) ?? null;

    const userIds = [...new Set(history.map((row) => row.changedById))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return {
      current: {
        method,
        effectiveFrom: inForce?.effectiveFrom ?? null,
        // No config row yet = AVERAGE since the beginning
        isDefault: inForce === null,
      },
      history: history.map((row) => ({
        id: row.id,
        method: row.method,
        effectiveFrom: row.effectiveFrom,
        reason: row.reason,
        changedById: row.changedById,
        changedByName: nameById.get(row.changedById) ?? null,
        createdAt: row.createdAt,
        isFuture: row.effectiveFrom.getTime() > now.getTime(),
      })),
    };
  }

  async setConfig(dto: SetCostingConfigDto, user: JwtUser) {
    if (!isAdmin(user)) {
      throw new ForbiddenException("Chỉ quản trị viên (Giám đốc) được đổi phương pháp tính giá xuất");
    }

    const effectiveFrom = dto.effectiveFrom;
    const isFiscalYearStart = effectiveFrom.getUTCMonth() === 0 && effectiveFrom.getUTCDate() === 1
      && effectiveFrom.getUTCHours() === 0 && effectiveFrom.getUTCMinutes() === 0 && effectiveFrom.getUTCSeconds() === 0;
    if (!isFiscalYearStart) {
      throw new BadRequestException("Ngày hiệu lực phải là ngày đầu năm tài chính (01/01 của một năm)");
    }
    const nextYear = new Date().getUTCFullYear() + 1;
    if (effectiveFrom.getUTCFullYear() < nextYear) {
      throw new BadRequestException(
        `Chỉ được đổi phương pháp tính giá từ năm tài chính ${nextYear} trở đi, không đổi giữa kỳ hoặc cho năm đã/đang chạy`
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${COSTING_CONFIG_LOCK}))`;

      // A config for the same (future) year may still be corrected before it takes effect.
      const sameYear = await tx.inventoryCostingConfig.findFirst({ where: { effectiveFrom } });
      const methodBefore = await getCostingMethod(tx, new Date(effectiveFrom.getTime() - 1));
      if (!sameYear && methodBefore === dto.method) {
        throw new BadRequestException(`Phương pháp ${dto.method} đã là phương pháp hiện hành trước ngày hiệu lực này`);
      }

      if (sameYear) {
        const updated = await tx.inventoryCostingConfig.update({
          where: { id: sameYear.id },
          data: { method: dto.method, reason: dto.reason, changedById: user.sub },
        });
        return { row: updated, before: { method: sameYear.method, reason: sameYear.reason, changedById: sameYear.changedById } };
      }
      const created = await tx.inventoryCostingConfig.create({
        data: { method: dto.method, effectiveFrom, reason: dto.reason, changedById: user.sub },
      });
      return { row: created, before: null };
    });

    try {
      await this.audit.record({
        userId: user.sub,
        action: "update",
        resource: "inventory-costing-config",
        resourceId: result.row.id,
        changes: {
          before: result.before,
          after: { method: result.row.method, effectiveFrom: result.row.effectiveFrom },
          reason: dto.reason,
          meta: { actorType: "USER" },
        },
      });
    } catch (error) {
      this.logger.error(`Audit costing config failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return this.getConfig();
  }
}
