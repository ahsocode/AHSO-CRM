import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { JwtUser } from "../auth/auth.types";
import { ProjectCostsService } from "./project-costs.service";

describe("ProjectCostsService", () => {
  const user: JwtUser = { sub: "u", email: "a@a.vn", name: "Staff", role: "STAFF", permissions: ["projects.view", "projects.edit"] };
  const costs = { findFirst: jest.fn(), update: jest.fn() };
  const tx = { projectCost: costs, $executeRaw: jest.fn() };
  const prisma = {
    projectCost: costs,
    project: { findFirst: jest.fn() },
    $transaction: jest.fn((fn: (db: typeof tx) => Promise<unknown>) => fn(tx))
  };
  const service = new ProjectCostsService(prisma as unknown as PrismaService);
  const draftCost = {
    id: "c", projectId: "p", amount: 1000, vatRate: null,
    allocation: { id: "a", status: "DRAFT", salesInvoiceDate: new Date("2026-03-31") }
  };

  beforeEach(() => {
    costs.findFirst.mockReset().mockResolvedValue(draftCost);
    costs.update.mockReset().mockResolvedValue({ ...draftCost, bomLine: null });
    prisma.project.findFirst.mockReset().mockResolvedValue({ id: "p" });
    tx.$executeRaw.mockClear();
  });

  it.each(["update", "remove"] as const)("blocks %s after an allocation was confirmed while waiting for the lock", async (method) => {
    costs.findFirst.mockResolvedValueOnce(draftCost).mockResolvedValueOnce({ ...draftCost, allocation: { ...draftCost.allocation, status: "CONFIRMED" } });
    await expect(method === "update" ? service.update("c", { amount: 2000 }, user) : service.remove("c", user)).rejects.toThrow(/đã xác nhận/);
    expect(costs.update).not.toHaveBeenCalled();
  });

  it("rejects a direct cost date later than its draft sales invoice", async () => {
    await expect(service.update("c", { invoiceDate: new Date("2026-04-01") }, user)).rejects.toThrow(BadRequestException);
  });

  it("allows the same invoice date and keeps the cost editable in a draft", async () => {
    await service.update("c", { invoiceDate: new Date("2026-03-31T16:00:00Z") }, user);
    expect(costs.update).toHaveBeenCalled();
  });

  it("hides costs outside the staff project scope", async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(service.remove("c", user)).rejects.toThrow(NotFoundException);
    expect(costs.update).not.toHaveBeenCalled();
  });
});
