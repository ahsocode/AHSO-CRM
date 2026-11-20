import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { JwtUser } from "../auth/auth.types";
import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../common/prisma.service";
import { CommonAllocationsService } from "./common-allocations.service";
import type { CommonAllocationDto } from "./dto/project-finance.dto";

const admin: JwtUser = { sub: "a", email: "a@a.vn", name: "A", role: "ADMIN", permissions: [] };
const noCost: JwtUser = { sub: "s", email: "s@a.vn", name: "S", role: "STAFF", permissions: ["projects.view"] };

function makeDb() {
  const writes = {
    allocationCreate: jest.fn().mockResolvedValue({ id: "alloc1" }),
    lineCreate: jest.fn().mockResolvedValue({}),
    costCreate: jest.fn().mockResolvedValue({ id: "cost" })
  };
  const db = {
    stockIssueItem: { findMany: jest.fn().mockResolvedValue([{ id: "i1", total: 1_000_001 }]) },
    project: {
      findMany: jest.fn().mockResolvedValue([
        { id: "p1", code: "P1", name: "P1" },
        { id: "p2", code: "P2", name: "P2" },
        { id: "p3", code: "P3", name: "P3" }
      ]),
      findFirst: jest.fn().mockResolvedValue({ id: "p1", costRecognitionStatus: "IN_PROGRESS" })
    },
    salesInvoice: {
      findMany: jest.fn().mockResolvedValue([
        { projectId: "p1", amountExVat: 100 },
        { projectId: "p2", amountExVat: 100 },
        { projectId: "p3", amountExVat: 100 }
      ])
    },
    stockIssue: { findMany: jest.fn().mockResolvedValue([]) },
    projectCost: { findMany: jest.fn().mockResolvedValue([]), create: writes.costCreate },
    commonCostAllocation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: writes.allocationCreate,
      findMany: jest.fn(),
      count: jest.fn()
    },
    commonCostAllocationLine: { create: writes.lineCreate },
    setting: { findUnique: jest.fn().mockResolvedValue(null) },
    $executeRaw: jest.fn(),
    $transaction: jest.fn()
  };
  db.$transaction.mockImplementation((fn: (t: typeof db) => Promise<unknown>) => fn(db));
  return { db, writes };
}

const base: CommonAllocationDto = {
  periodFrom: new Date("2026-10-01"),
  periodTo: new Date("2026-10-31"),
  mode: "PREVIEW",
  basis: "REVENUE"
};

describe("CommonAllocationsService", () => {
  const audit = { record: jest.fn() };
  let ctx: ReturnType<typeof makeDb>;
  let service: CommonAllocationsService;

  beforeEach(() => {
    ctx = makeDb();
    audit.record.mockReset();
    service = new CommonAllocationsService(ctx.db as unknown as PrismaService, audit as unknown as AuditService);
    // findOne after confirm reads the stored allocation
    jest.spyOn(service, "findOne").mockResolvedValue({ id: "alloc1" } as never);
  });

  it("PREVIEW splits 1,000,001 across 3 projects exactly and writes nothing", async () => {
    const result = await service.allocate({ ...base, mode: "PREVIEW" }, admin);
    expect(result.persisted).toBe(false);
    if (result.mode !== "PREVIEW") throw new Error("expected preview");
    expect(result.totalAmount).toBe(1_000_001);
    expect(result.lines).toHaveLength(3);
    expect(result.lines.reduce((s, l) => s + l.amount, 0)).toBe(1_000_001);
    expect(result.allocatedTotal).toBe(1_000_001);
    expect(ctx.writes.allocationCreate).not.toHaveBeenCalled();
    expect(ctx.writes.lineCreate).not.toHaveBeenCalled();
    expect(ctx.writes.costCreate).not.toHaveBeenCalled();
    expect(ctx.db.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("CONFIRM writes allocation, lines and a ProjectCost per line, then audits", async () => {
    const result = await service.allocate({ ...base, mode: "CONFIRM" }, admin);
    expect(result).toMatchObject({ persisted: true, idempotent: false });
    expect(ctx.writes.allocationCreate).toHaveBeenCalledTimes(1);
    expect(ctx.writes.allocationCreate.mock.calls[0][0].data.totalAmount).toBe(1_000_001);
    expect(ctx.writes.lineCreate).toHaveBeenCalledTimes(3);
    expect(ctx.writes.costCreate).toHaveBeenCalledTimes(3);
    const lineSum = ctx.writes.costCreate.mock.calls.reduce((s, c) => s + (c[0].data.amount as number), 0);
    expect(lineSum).toBe(1_000_001);
    expect(ctx.writes.costCreate.mock.calls[0][0].data.group).toBe("OTHER");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "common-allocation.confirm" }));
  });

  it("CONFIRM is idempotent for the same period (returns existing, writes nothing)", async () => {
    ctx.db.commonCostAllocation.findFirst.mockResolvedValue({ id: "alloc1", periodFrom: base.periodFrom, periodTo: base.periodTo });
    const result = await service.allocate({ ...base, mode: "CONFIRM" }, admin);
    expect(result).toMatchObject({ persisted: true, idempotent: true });
    expect(ctx.writes.allocationCreate).not.toHaveBeenCalled();
    expect(ctx.writes.costCreate).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("CONFIRM returns the winner when a concurrent request hits the unique index", async () => {
    ctx.writes.allocationCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    ctx.db.commonCostAllocation.findFirst
      .mockResolvedValueOnce(null) // overlap check inside tx
      .mockResolvedValue({ id: "alloc1" }); // lookup after the violation
    const result = await service.allocate({ ...base, mode: "CONFIRM" }, admin);
    expect(result).toMatchObject({ idempotent: true });
  });

  it("CONFIRM rejects an overlapping but different period with 409", async () => {
    ctx.db.commonCostAllocation.findFirst.mockResolvedValue({ id: "x", periodFrom: new Date("2026-10-15"), periodTo: new Date("2026-11-15") });
    await expect(service.allocate({ ...base, mode: "CONFIRM" }, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.writes.allocationCreate).not.toHaveBeenCalled();
  });

  it("CONFIRM is rejected when the period end falls in a locked period", async () => {
    ctx.db.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2026-10-31") });
    await expect(service.allocate({ ...base, mode: "CONFIRM" }, admin)).rejects.toThrow(/Kỳ kế toán đã khóa/);
    expect(ctx.db.$transaction).not.toHaveBeenCalled();
  });

  it("CONFIRM needs inventory.approve; viewing needs inventory.view_cost", async () => {
    const viewer: JwtUser = { ...noCost, permissions: ["inventory.view_cost"] };
    await expect(service.allocate({ ...base, mode: "CONFIRM" }, viewer)).rejects.toThrow(/duyệt/);
    await expect(service.allocate({ ...base, mode: "PREVIEW" }, noCost)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("MANUAL basis uses the given shares", async () => {
    const result = await service.allocate(
      { ...base, basis: "MANUAL", manualShares: [{ projectId: "p1", share: 1 }, { projectId: "p2", share: 3 }] },
      admin
    );
    if (result.mode !== "PREVIEW") throw new Error("expected preview");
    expect(result.lines.map((l) => l.amount)).toEqual([250_000, 750_001]);
  });
});
