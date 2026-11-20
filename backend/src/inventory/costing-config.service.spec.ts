import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { CostingConfigService } from "./costing-config.service";
import { getCostingMethod } from "./inventory-controls";

interface Row { id: string; method: "AVERAGE" | "FIFO"; effectiveFrom: Date; changedById: string; reason: string | null; createdAt: Date }

describe("CostingConfigService", () => {
  const admin = { sub: "admin-1", email: "a@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  const manager = { sub: "m-1", email: "m@ahso.vn", name: "M", role: "MANAGER" as const, permissions: ["inventory.approve"] };
  const thisYear = new Date().getUTCFullYear();
  const jan1 = (year: number) => new Date(Date.UTC(year, 0, 1));

  let rows: Row[];
  let audit: { record: jest.Mock };
  let service: CostingConfigService;
  let db: Record<string, unknown>;

  beforeEach(() => {
    rows = [];
    audit = { record: jest.fn().mockResolvedValue({}) };
    const config = {
      findFirst: jest.fn(async ({ where }: { where: { effectiveFrom: Date | { lte: Date } } }) => {
        const w = where.effectiveFrom;
        const lte = w instanceof Date ? undefined : w.lte;
        const exact = w instanceof Date ? w : undefined;
        return [...rows]
          .filter((r) => (exact ? r.effectiveFrom.getTime() === exact.getTime() : r.effectiveFrom.getTime() <= lte!.getTime()))
          .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
      }),
      findMany: jest.fn(async () => [...rows].sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())),
      create: jest.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
        const row = { ...data, id: `c${rows.length + 1}`, createdAt: new Date() };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    };
    db = {
      inventoryCostingConfig: config,
      user: { findMany: jest.fn(async () => [{ id: "admin-1", name: "Admin" }]) },
      $executeRaw: jest.fn(),
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    };
    service = new CostingConfigService(db as unknown as PrismaService, audit as unknown as AuditService);
  });

  it("defaults to AVERAGE with an empty history", async () => {
    const result = await service.getConfig();
    expect(result.current).toMatchObject({ method: "AVERAGE", isDefault: true, effectiveFrom: null });
    expect(result.history).toEqual([]);
  });

  it("rejects a change that takes effect in the current or a past fiscal year, with the reason", async () => {
    await expect(service.setConfig({ method: "FIFO", effectiveFrom: jan1(thisYear), reason: "Đổi giữa năm" }, admin))
      .rejects.toThrow(new RegExp(`năm tài chính ${thisYear + 1}`));
    await expect(service.setConfig({ method: "FIFO", effectiveFrom: jan1(thisYear - 1), reason: "Đổi năm cũ" }, admin))
      .rejects.toThrow(BadRequestException);
    expect(rows).toHaveLength(0);
  });

  it("requires the first day of a fiscal year", async () => {
    await expect(service.setConfig({ method: "FIFO", effectiveFrom: new Date(Date.UTC(thisYear + 1, 5, 1)), reason: "Giữa năm sau" }, admin))
      .rejects.toThrow(/đầu năm tài chính/);
  });

  it("only ADMIN can change it", async () => {
    await expect(service.setConfig({ method: "FIFO", effectiveFrom: jan1(thisYear + 1), reason: "Đổi phương pháp" }, manager))
      .rejects.toThrow(ForbiddenException);
  });

  it("accepts next fiscal year, records who/why, audits, and returns history", async () => {
    const result = await service.setConfig({ method: "FIFO", effectiveFrom: jan1(thisYear + 1), reason: "Kế toán đề nghị" }, admin);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ method: "FIFO", changedById: "admin-1", reason: "Kế toán đề nghị" });
    expect(result.history[0]).toMatchObject({ method: "FIFO", changedByName: "Admin", reason: "Kế toán đề nghị", isFuture: true });
    // still AVERAGE today: the change only applies from next year
    expect(result.current.method).toBe("AVERAGE");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ resource: "inventory-costing-config", changes: expect.objectContaining({ reason: "Kế toán đề nghị" }) })
    );
  });

  it("documents before/after the effective date use the method in force on their own date", async () => {
    await service.setConfig({ method: "FIFO", effectiveFrom: jan1(thisYear + 1), reason: "Kế toán đề nghị" }, admin);
    expect(await getCostingMethod(db as never, new Date(Date.UTC(thisYear, 11, 31)))).toBe("AVERAGE");
    expect(await getCostingMethod(db as never, jan1(thisYear + 1))).toBe("FIFO");
    expect(await getCostingMethod(db as never, new Date(Date.UTC(thisYear + 1, 5, 1)))).toBe("FIFO");
  });

  it("a not-yet-effective config can be corrected; a no-op change is rejected; reason is mandatory in the schema", async () => {
    await service.setConfig({ method: "FIFO", effectiveFrom: jan1(thisYear + 1), reason: "Kế toán đề nghị" }, admin);
    await service.setConfig({ method: "AVERAGE", effectiveFrom: jan1(thisYear + 1), reason: "Hủy đề nghị trước" }, admin);
    expect(rows).toHaveLength(1);
    expect(rows[0].method).toBe("AVERAGE");

    await expect(service.setConfig({ method: "AVERAGE", effectiveFrom: jan1(thisYear + 2), reason: "Không đổi gì" }, admin))
      .rejects.toThrow(/đã là phương pháp hiện hành/);

    const { setCostingConfigSchema } = await import("./dto/costing-config.dto");
    expect(setCostingConfigSchema.safeParse({ method: "FIFO", effectiveFrom: "2028-01-01", reason: "ab" }).success).toBe(false);
  });
});
