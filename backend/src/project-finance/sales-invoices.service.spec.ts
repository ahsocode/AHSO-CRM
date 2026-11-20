import { ConflictException } from "@nestjs/common";
import type { JwtUser } from "../auth/auth.types";
import type { AuditService } from "../audit/audit.service";
import type { PrismaService } from "../common/prisma.service";
import { SalesInvoicesService } from "./sales-invoices.service";

const user: JwtUser = { sub: "u1", email: "a@a.vn", name: "A", role: "ADMIN", permissions: [] };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv1", projectId: "p1", contractId: null, series: "C26TAA", number: "1", date: new Date("2026-11-10"),
    buyerTaxCode: null, amountExVat: 1000, vatAmount: 100, status: "ISSUED", notes: null, createdById: "u1",
    createdAt: new Date(), updatedAt: new Date(), project: { id: "p1", code: "P", name: "P" }, contract: null,
    ...overrides
  };
}

describe("SalesInvoicesService", () => {
  const invoice = { findFirst: jest.fn(), create: jest.fn(), count: jest.fn(), updateMany: jest.fn(), findFirstOrThrow: jest.fn() };
  const tx = { salesInvoice: invoice, project: { findFirst: jest.fn() }, $executeRaw: jest.fn() };
  const prisma = {
    salesInvoice: invoice,
    project: { findFirst: jest.fn() },
    contract: { findFirst: jest.fn() },
    setting: { findUnique: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx))
  };
  const audit = { record: jest.fn() };
  const service = new SalesInvoicesService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  const dto = { projectId: "p1", series: "c26taa", number: "1", date: new Date("2026-11-10"), amountExVat: 1000, vatAmount: 100 };

  beforeEach(() => {
    Object.values(invoice).forEach((m) => m.mockReset());
    prisma.project.findFirst.mockReset().mockResolvedValue({ id: "p1" });
    prisma.setting.findUnique.mockReset().mockResolvedValue(null);
    tx.project.findFirst.mockReset().mockResolvedValue({ costRecognitionStatus: "IN_PROGRESS" });
    audit.record.mockReset();
  });

  it("creates an invoice with normalised series", async () => {
    invoice.findFirst.mockResolvedValue(null);
    invoice.create.mockResolvedValue(makeRow());
    const result = await service.create(dto, user);
    expect(invoice.create.mock.calls[0][0].data.series).toBe("C26TAA");
    expect(result.totalAmount).toBe(1100);
    expect(audit.record).toHaveBeenCalled();
  });

  it("returns a Vietnamese 409 when (series, number) already exists", async () => {
    invoice.findFirst.mockResolvedValue({ id: "old", projectId: "p9" });
    const promise = service.create(dto, user);
    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(service.create(dto, user)).rejects.toThrow(/đã tồn tại/);
    expect(invoice.create).not.toHaveBeenCalled();
  });

  it("maps a DB unique violation (race) to the same 409", async () => {
    invoice.findFirst.mockResolvedValueOnce(null).mockResolvedValue({ id: "winner", projectId: "p1" });
    invoice.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(service.create(dto, user)).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects creation inside a locked period", async () => {
    prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2026-11-30") });
    await expect(service.create(dto, user)).rejects.toThrow(/Kỳ kế toán đã khóa/);
    expect(invoice.create).not.toHaveBeenCalled();
  });

  it("rejects cancel inside a locked period", async () => {
    invoice.findFirst.mockResolvedValue(makeRow());
    prisma.setting.findUnique.mockResolvedValue({ value: JSON.stringify("2026-11-30") });
    await expect(service.cancel("inv1", { reason: "nhập sai số" }, user)).rejects.toThrow(/Kỳ kế toán đã khóa/);
  });

  it("cancels and marks REPLACED with a link when a replacement is given", async () => {
    invoice.findFirst
      .mockResolvedValueOnce(makeRow())
      .mockResolvedValueOnce({ id: "inv2", series: "C26TAA", number: "2" });
    invoice.updateMany.mockResolvedValue({ count: 1 });
    invoice.findFirstOrThrow.mockResolvedValue(makeRow({ status: "REPLACED" }));
    await service.cancel("inv1", { reason: "xuất sai số", replacedByInvoiceId: "inv2" }, user);
    const data = invoice.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("REPLACED");
    expect(data.notes).toContain("C26TAA-2");
  });

  it("refuses to cancel an already cancelled invoice", async () => {
    invoice.findFirst.mockResolvedValue(makeRow({ status: "CANCELLED" }));
    await expect(service.cancel("inv1", { reason: "lần hai" }, user)).rejects.toThrow(/đã bị hủy/);
    expect(invoice.updateMany).not.toHaveBeenCalled();
  });
});
