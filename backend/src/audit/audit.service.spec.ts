import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PrismaService } from "../common/prisma.service";
import { ROLE_VALUES } from "../common/constants/role.constants";
import { ROLES_KEY } from "../common/decorators/roles.decorator";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { auditLogFilterSchema } from "./dto/audit-log-filter.dto";

function setup() {
  const prisma = {
    auditLog: { create: jest.fn().mockResolvedValue({ id: "a1" }), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
  };
  return { prisma, service: new AuditService(prisma as unknown as PrismaService) };
}

describe("AuditService.recordEvent", () => {
  it("stores before/after/reason and tags USER actor", async () => {
    const { service, prisma } = setup();
    await service.recordEvent({
      userId: "u1", action: "x.y", resource: "res", resourceId: "r1", ip: "1.1.1.1",
      changes: { before: { a: 1 }, after: { a: 2 }, reason: "vì lý do" }
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: "u1", action: "x.y", resource: "res", resourceId: "r1", ip: "1.1.1.1",
      changes: { before: { a: 1 }, after: { a: 2 }, reason: "vì lý do", meta: { actorType: "USER" } }
    });
  });

  it("tags SERVICE actors and redacts secrets", async () => {
    const { service, prisma } = setup();
    await service.recordEvent({
      userId: "service:t1", action: "x", resource: "res",
      changes: { after: { token: "ahso_sa_secret", tokenHash: "h", nested: { authorization: "Bearer z", ok: 1 } } }
    });
    const changes = prisma.auditLog.create.mock.calls[0][0].data.changes;
    expect(changes.meta.actorType).toBe("SERVICE");
    expect(JSON.stringify(changes)).not.toContain("ahso_sa_secret");
    expect(changes.after.token).toBe("[REDACTED]");
    expect(changes.after.tokenHash).toBe("[REDACTED]");
    expect(changes.after.nested).toEqual({ authorization: "[REDACTED]", ok: 1 });
  });

  it("uses the supplied transaction client", async () => {
    const { service, prisma } = setup();
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    await service.recordEvent({ userId: "u", action: "a", resource: "r" }, tx as never);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("AuditService.findAll filters", () => {
  it("applies resource, resourceId, userId, action, date range and pagination", async () => {
    const { service, prisma } = setup();
    const filters = auditLogFilterSchema.parse({
      resource: "stock-receipts", resourceId: "r1", userId: "u1", action: "confirm",
      from: "2026-10-01", to: "2026-10-31", page: "2", limit: "10"
    });
    await service.findAll(filters);
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ resource: "stock-receipts", resourceId: "r1", userId: "u1", action: "confirm" });
    expect(args.where.createdAt.gte.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(args.where.createdAt.lte.toISOString()).toBe("2026-10-31T23:59:59.999Z");
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
  });

  it("rejects invalid dates", () => {
    expect(auditLogFilterSchema.safeParse({ from: "garbage" }).success).toBe(false);
  });
});

describe("AuditController", () => {
  it("is restricted to ADMIN and MANAGER and exposes /audit", () => {
    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual([ROLE_VALUES[0], ROLE_VALUES[1]]);
    expect(Reflect.getMetadata("path", AuditController)).toEqual(["audit-logs", "audit"]);
  });

  it("no source code updates or deletes AuditLog rows (DB trigger makes it immutable)", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => (statSync(join(dir, e)).isDirectory() ? walk(join(dir, e)) : e.endsWith(".ts") && !e.endsWith(".spec.ts") ? [join(dir, e)] : []));
    const offenders = walk(join(__dirname, "..")).filter((f) => /auditLog\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
