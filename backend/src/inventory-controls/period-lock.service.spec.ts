import { BadRequestException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { ROLES_KEY } from "../common/decorators/roles.decorator";
import { parseLockedUntil, setPeriodLockSchema } from "./dto/set-period-lock.dto";
import { PeriodLockController } from "./period-lock.controller";
import { PeriodLockService } from "./period-lock.service";

const admin = { sub: "admin-1", email: "a@x", name: "A", role: "ADMIN" as const, permissions: [] };

function setup(currentValue: string | null) {
  const tx = {
    setting: {
      findUnique: jest.fn().mockResolvedValue(currentValue === null ? null : { value: currentValue }),
      upsert: jest.fn().mockResolvedValue({})
    },
    periodLockHistory: { create: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({ id: "h1", ...data })) }
  };
  const prisma = {
    ...tx,
    periodLockHistory: { ...tx.periodLockHistory, findMany: jest.fn().mockResolvedValue([{ id: "h0" }]) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx))
  };
  const audit = { recordEvent: jest.fn().mockResolvedValue({}) };
  return { service: new PeriodLockService(prisma as unknown as PrismaService, audit as unknown as AuditService), tx, prisma, audit };
}

const parse = (lockedUntil: string | null, reason = "Chốt sổ tháng 10") => setPeriodLockSchema.parse({ lockedUntil, reason });
const parsedDate = (v: string | null) => parseLockedUntil(v);

describe("setPeriodLockSchema", () => {
  it("requires reason >= 5 chars, even for unlock", () => {
    expect(setPeriodLockSchema.safeParse({ lockedUntil: "2026-10-31", reason: "abcd" }).success).toBe(false);
    expect(setPeriodLockSchema.safeParse({ lockedUntil: null, reason: "" }).success).toBe(false);
    expect(setPeriodLockSchema.safeParse({ lockedUntil: null }).success).toBe(false);
  });

  it("normalises date-only to end of UTC day, accepts null, rejects garbage", () => {
    expect(parsedDate("2026-10-31")?.toISOString()).toBe("2026-10-31T23:59:59.999Z");
    expect(parsedDate(null)).toBeNull();
    expect(parse(null).lockedUntil).toBeNull();
    expect(setPeriodLockSchema.safeParse({ lockedUntil: "not-a-date", reason: "hợp lệ rồi" }).success).toBe(false);
  });
});

describe("PeriodLockService", () => {
  it("sets the lock: Setting + history + audit in one transaction", async () => {
    const { service, tx, prisma, audit } = setup(null);
    const res = await service.set(parse("2026-10-31"), admin, "1.1.1.1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.setting.upsert.mock.calls[0][0].update.value).toBe(JSON.stringify("2026-10-31T23:59:59.999Z"));
    expect(tx.periodLockHistory.create.mock.calls[0][0].data).toMatchObject({
      previousLockedUntil: null, changedById: "admin-1", reason: "Chốt sổ tháng 10"
    });
    expect(audit.recordEvent.mock.calls[0][0]).toMatchObject({ action: "period_lock.set", changes: { reason: "Chốt sổ tháng 10" } });
    expect(audit.recordEvent.mock.calls[0][1]).toBe(tx);
    expect(res.lockedUntil?.toISOString()).toBe("2026-10-31T23:59:59.999Z");
  });

  it("moving forward is flagged as not re-opening", async () => {
    const { service, audit } = setup(JSON.stringify("2026-09-30T23:59:59.999Z"));
    await service.set(parse("2026-10-31"), admin);
    expect(audit.recordEvent.mock.calls[0][0]).toMatchObject({ action: "period_lock.set", changes: { meta: { reopensPeriod: false } } });
  });

  it("moving backward and unlocking are recorded as re-opening with reason", async () => {
    const back = setup(JSON.stringify("2026-10-31T23:59:59.999Z"));
    await back.service.set(parse("2026-09-30", "Sửa phiếu nhập sai kỳ"), admin);
    expect(back.audit.recordEvent.mock.calls[0][0]).toMatchObject({ action: "period_lock.move_back", changes: { reason: "Sửa phiếu nhập sai kỳ" } });

    const unlock = setup(JSON.stringify("2026-10-31T23:59:59.999Z"));
    await unlock.service.set(parse(null, "Mở khóa để điều chỉnh"), admin);
    expect(unlock.tx.setting.upsert.mock.calls[0][0].update.value).toBe("null");
    expect(unlock.audit.recordEvent.mock.calls[0][0]).toMatchObject({ action: "period_lock.unlock" });
    expect(unlock.tx.periodLockHistory.create.mock.calls[0][0].data.newLockedUntil).toBeNull();
  });

  it("rejects a no-op change", async () => {
    const { service, audit } = setup(JSON.stringify("2026-10-31T23:59:59.999Z"));
    await expect(service.set(parse("2026-10-31"), admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.recordEvent).not.toHaveBeenCalled();
  });

  it("get returns current value and history", async () => {
    const { service } = setup(JSON.stringify("2026-10-31T23:59:59.999Z"));
    const res = await service.get();
    expect(res.lockedUntil?.toISOString()).toBe("2026-10-31T23:59:59.999Z");
    expect(res.history).toEqual([{ id: "h0" }]);
  });
});

describe("PeriodLockController", () => {
  it("is ADMIN only", () => {
    expect(Reflect.getMetadata(ROLES_KEY, PeriodLockController)).toEqual([ROLE_VALUES[0]]);
  });
});
