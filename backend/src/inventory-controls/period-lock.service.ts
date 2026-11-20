import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { getPeriodLockedUntil, INVENTORY_SETTING_KEYS } from "../inventory/inventory-controls";
import { parseLockedUntil, type SetPeriodLockDto } from "./dto/set-period-lock.dto";

const HISTORY_LIMIT = 100;

@Injectable()
export class PeriodLockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async get() {
    const [lockedUntil, history] = await Promise.all([
      getPeriodLockedUntil(this.prisma),
      this.prisma.periodLockHistory.findMany({ orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT })
    ]);
    return { lockedUntil, history };
  }

  /** Setting + history row + audit event commit atomically. ADMIN-only is enforced by the controller. */
  async set(dto: SetPeriodLockDto, actor: JwtUser, ip?: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await getPeriodLockedUntil(tx);
      const next = parseLockedUntil(dto.lockedUntil);

      if ((previous?.getTime() ?? null) === (next?.getTime() ?? null)) {
        throw new BadRequestException("Giá trị khóa sổ không thay đổi");
      }

      // Moving the lock backwards (or unlocking) re-opens closed periods; flagged in the audit trail.
      const reopens = previous !== null && (next === null || next.getTime() < previous.getTime());

      await tx.setting.upsert({
        where: { key: INVENTORY_SETTING_KEYS.periodLockedUntil },
        create: {
          key: INVENTORY_SETTING_KEYS.periodLockedUntil,
          value: JSON.stringify(next ? next.toISOString() : null),
          description: "Ngày khóa sổ kho (chứng từ có ngày <= giá trị này bị chặn)"
        },
        update: { value: JSON.stringify(next ? next.toISOString() : null) }
      });

      const history = await tx.periodLockHistory.create({
        data: {
          previousLockedUntil: previous,
          newLockedUntil: next,
          changedById: actor.sub,
          reason: dto.reason
        }
      });

      await this.audit.recordEvent(
        {
          userId: actor.sub,
          action: next === null ? "period_lock.unlock" : reopens ? "period_lock.move_back" : "period_lock.set",
          resource: "inventory-period-lock",
          resourceId: history.id,
          changes: {
            before: { lockedUntil: previous },
            after: { lockedUntil: next },
            reason: dto.reason,
            meta: { reopensPeriod: reopens }
          },
          ip
        },
        tx
      );

      return { lockedUntil: next, previousLockedUntil: previous, history };
    });
  }
}
