import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { JwtUser } from "../auth/auth.types";
import { CostReportsService } from "./cost-reports.service";
import { selectEstimateBoms } from "./estimate-basis";

describe("CostReportsService", () => {
  const user: JwtUser = { sub: "u", email: "a@a.vn", name: "Admin", role: "ADMIN", permissions: [] };
  const prisma = {
    project: { findFirst: jest.fn() },
    contract: { findFirst: jest.fn() },
    quote: { findFirst: jest.fn() },
    projectMaterialAllocation: { findMany: jest.fn() },
    projectCost: { findMany: jest.fn() },
    bom: { findMany: jest.fn() },
    bomLine: { findMany: jest.fn() }
  };
  const service = new CostReportsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.project.findFirst.mockResolvedValue({ id: "p" });
    prisma.contract.findFirst.mockResolvedValue(null);
    prisma.quote.findFirst.mockResolvedValue(null);
    prisma.projectMaterialAllocation.findMany.mockResolvedValue([]);
    prisma.projectCost.findMany.mockResolvedValue([]);
    prisma.bom.findMany.mockResolvedValue([]);
    prisma.bomLine.findMany.mockResolvedValue([]);
  });

  it("uses the contract source VAT and subtracts stock and direct costs before computing margin", async () => {
    prisma.contract.findFirst.mockResolvedValue({
      id: "c", contractNo: "HD-1", value: 10800000,
      items: [{ total: 10000000, quoteItem: { quote: { taxRate: 8 } } }]
    });
    prisma.quote.findFirst.mockResolvedValue({ id: "q-new", taxRate: 10, acceptedItemIds: [], items: [], subtotal: 20000000 });
    prisma.projectMaterialAllocation.findMany.mockResolvedValue([
      { id: "a", salesInvoiceNo: "01", salesInvoiceDate: new Date(), items: [{ total: 300000, bomLineId: null, bomLine: null }] }
    ]);
    prisma.projectCost.findMany.mockResolvedValue([{ group: "SOFTWARE", amount: 2000000, bomLineId: null }]);

    const result = await service.getCostSummary("p", user);
    expect(result).toMatchObject({ revenue: 10000000, materialCost: 300000, directCost: 2000000, grossProfit: 7700000, grossMarginPct: 77 });
  });

  it("assumes standard VAT when a contract has no items and no accepted quote", async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: "c", contractNo: "HD-2", value: 11000000, items: [] });
    prisma.quote.findFirst.mockResolvedValue(null);
    expect(await service.getCostSummary("p", user)).toMatchObject({
      revenue: 10000000, revenueSource: "CONTRACT", revenueVatAssumed: true, revenueVatRate: 10
    });
  });

  it("assumes standard VAT for manual contract items without a source quote", async () => {
    prisma.contract.findFirst.mockResolvedValue({
      id: "c", contractNo: "HD-3", value: 11000000, items: [{ total: 10000000, quoteItem: null }]
    });
    prisma.quote.findFirst.mockResolvedValue(null);
    expect(await service.getCostSummary("p", user)).toMatchObject({ revenue: 10000000, revenueVatAssumed: true });
  });

  it("counts only accepted quote items when there is no contract", async () => {
    prisma.quote.findFirst.mockResolvedValue({
      id: "q", quoteNo: "BG-1", taxRate: 10, subtotal: 3000, acceptedItemIds: ["i1"],
      items: [{ id: "i1", total: 1000 }, { id: "i2", total: 2000 }]
    });
    expect(await service.getCostSummary("p", user)).toMatchObject({ revenue: 1000, revenueSource: "QUOTE", grossProfit: 1000 });
  });

  it("does not load costs for a project outside the user's scope", async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(service.getCostSummary("p", { ...user, role: "STAFF" })).rejects.toThrow(NotFoundException);
    expect(prisma.projectCost.findMany).not.toHaveBeenCalled();
  });
});

describe("estimate version selection", () => {
  const bom = (id: string, version: number, status: string, sourceBomId: string | null = null) => ({ id, version, status, sourceBomId });

  it("keeps independent machines, preferring an approved version over its new draft", () => {
    const rows = [bom("a", 1, "APPROVED"), bom("a2", 2, "DRAFT", "a"), bom("b", 1, "DRAFT")];
    expect(selectEstimateBoms(rows).map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("selects one newest approved version across a chain and sibling branches", () => {
    const rows = [bom("a", 1, "APPROVED"), bom("a2", 2, "APPROVED", "a"), bom("a3", 3, "APPROVED", "a2"), bom("a4", 4, "APPROVED", "a")];
    expect(selectEstimateBoms(rows).map((row) => row.id)).toEqual(["a4"]);
  });

  it("does not treat a copied v1 BOM as a replacement", () => {
    expect(selectEstimateBoms([bom("a", 1, "APPROVED"), bom("copy", 1, "DRAFT", "a")])).toHaveLength(2);
  });
});
