import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { JwtUser } from "../auth/auth.types";
import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../common/prisma.service";
import { assertProjectCostOpen } from "./cost-lock";
import { CostRecognitionService } from "./cost-recognition.service";

const admin: JwtUser = { sub: "a", email: "a@a.vn", name: "A", role: "ADMIN", permissions: [] };
const staff: JwtUser = { sub: "s", email: "s@a.vn", name: "S", role: "STAFF", permissions: ["projects.edit"] };

describe("assertProjectCostOpen", () => {
  it("throws when the project is DELIVERED", async () => {
    const db = { project: { findFirst: jest.fn().mockResolvedValue({ id: "p", costRecognitionStatus: "DELIVERED" }) } };
    await expect(assertProjectCostOpen(db as never, "p")).rejects.toThrow(BadRequestException);
  });
  it("passes for IN_PROGRESS and for unassigned costs", async () => {
    const db = { project: { findFirst: jest.fn().mockResolvedValue({ id: "p", costRecognitionStatus: "IN_PROGRESS" }) } };
    await expect(assertProjectCostOpen(db as never, "p")).resolves.toBeUndefined();
    await expect(assertProjectCostOpen(db as never, null)).resolves.toBeUndefined();
  });
});

describe("CostRecognitionService", () => {
  const project = { findFirst: jest.fn(), update: jest.fn() };
  const salesInvoice = { count: jest.fn() };
  const setting = { findUnique: jest.fn() };
  const tx = { project, salesInvoice, setting, $executeRaw: jest.fn() };
  const prisma = {
    project,
    setting,
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx))
  };
  const audit = { record: jest.fn() };
  const service = new CostRecognitionService(prisma as unknown as PrismaService, audit as unknown as AuditService);

  beforeEach(() => {
    project.findFirst.mockReset().mockResolvedValue({ id: "p", costRecognitionStatus: "IN_PROGRESS", costRecognizedAt: null });
    project.update.mockReset().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "p", ...data }));
    salesInvoice.count.mockReset().mockResolvedValue(1);
    prisma.setting.findUnique.mockReset().mockResolvedValue(null);
    audit.record.mockReset();
  });

  it("DELIVER needs at least one active sales invoice", async () => {
    salesInvoice.count.mockResolvedValue(0);
    await expect(service.recognize("p", { action: "DELIVER" }, staff)).rejects.toThrow(/hóa đơn bán ra/);
    expect(project.update).not.toHaveBeenCalled();
  });

  it("DELIVER without invoice: override is ADMIN-only and needs a reason", async () => {
    salesInvoice.count.mockResolvedValue(0);
    await expect(service.recognize("p", { action: "DELIVER", overrideNoInvoice: true, reason: "x" }, staff)).rejects.toThrow(BadRequestException);
    await expect(service.recognize("p", { action: "DELIVER", overrideNoInvoice: true }, admin)).rejects.toThrow(/lý do/);
    const ok = await service.recognize("p", { action: "DELIVER", overrideNoInvoice: true, reason: "Bàn giao trước khi xuất hóa đơn" }, admin);
    expect(ok.costRecognitionStatus).toBe("DELIVERED");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "project.cost-recognition.deliver" }));
  });

  it("DELIVER with an invoice sets status and date, and audits", async () => {
    const result = await service.recognize("p", { action: "DELIVER" }, staff);
    expect(result).toMatchObject({ costRecognitionStatus: "DELIVERED", changed: true });
    expect(result.costRecognizedAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it("DELIVER again is idempotent (no update, no audit)", async () => {
    project.findFirst.mockResolvedValue({ id: "p", costRecognitionStatus: "DELIVERED", costRecognizedAt: new Date() });
    const result = await service.recognize("p", { action: "DELIVER" }, staff);
    expect(result.changed).toBe(false);
    expect(project.update).not.toHaveBeenCalled();
  });

  it("DELIVER is rejected when the recognition date is in a locked period", async () => {
    prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2099-01-01") });
    await expect(service.recognize("p", { action: "DELIVER" }, admin)).rejects.toThrow(/Kỳ kế toán đã khóa/);
  });

  it("REOPEN requires inventory.approve and a reason", async () => {
    await expect(service.recognize("p", { action: "REOPEN", reason: "sửa chi phí" }, staff)).rejects.toThrow(ForbiddenException);
    await expect(service.recognize("p", { action: "REOPEN" }, admin)).rejects.toThrow(/lý do/);
  });

  it("REOPEN flips DELIVERED back and is blocked in a locked period", async () => {
    project.findFirst.mockResolvedValue({ id: "p", costRecognitionStatus: "DELIVERED", costRecognizedAt: new Date("2026-10-15") });
    prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2026-10-31") });
    await expect(service.recognize("p", { action: "REOPEN", reason: "điều chỉnh" }, admin)).rejects.toThrow(/Kỳ kế toán đã khóa/);

    prisma.setting.findUnique.mockResolvedValue(null);
    const result = await service.recognize("p", { action: "REOPEN", reason: "điều chỉnh chi phí" }, admin);
    expect(result.costRecognitionStatus).toBe("IN_PROGRESS");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "project.cost-recognition.reopen" }));
  });
});
