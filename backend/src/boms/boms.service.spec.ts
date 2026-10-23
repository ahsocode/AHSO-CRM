import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { CostLineInput, computeBomGraphTotals, findLinesMissingMaterial, wouldCreateCycle } from "./bom-cost";
import { BomsService } from "./boms.service";

const admin: JwtUser = { sub: "u1", email: "a@ahso.vn", name: "Admin", role: "ADMIN", permissions: [] };
const staff: JwtUser = { sub: "u2", email: "s@ahso.vn", name: "Staff", role: "STAFF", permissions: ["projects.view", "projects.edit"] };

type Mocks = Record<string, jest.Mock>;

describe("BomsService", () => {
  let service: BomsService;
  let tx: Record<string, Mocks | jest.Mock>;
  let prisma: Record<string, unknown>;
  let bom: Mocks;
  let bomLine: Mocks;

  const draftProjectBom = { id: "b1", code: "BOM-2026-001", kind: "PROJECT", status: "DRAFT", projectId: "p1", productId: null, version: 1, name: "Máy A", notes: null };

  beforeEach(() => {
    bom = {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "new", code: "BOM-2026-002", version: 2 }),
      update: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
      count: jest.fn().mockResolvedValue(0)
    };
    bomLine = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn()
    };
    tx = { $executeRaw: jest.fn(), bom, bomLine, material: { findFirst: jest.fn(), create: jest.fn() } };
    prisma = {
      bom,
      bomLine,
      material: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      project: { findFirst: jest.fn().mockResolvedValue({ id: "p1" }) },
      quoteItem: { count: jest.fn().mockResolvedValue(0) },
      projectMaterialAllocationItem: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      projectCost: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) => fn(tx))
    };
    service = new BomsService(prisma as unknown as PrismaService);
  });

  describe("R1 code generation", () => {
    it("starts at 001 for a new year", async () => {
      bom.findFirst.mockResolvedValue(null);
      const code = await service.generateNextBomCode(tx as never);
      expect(code).toBe(`BOM-${new Date().getFullYear()}-001`);
    });

    it("increments the latest code", async () => {
      bom.findFirst.mockResolvedValue({ code: `BOM-${new Date().getFullYear()}-009` });
      const code = await service.generateNextBomCode(tx as never);
      expect(code).toBe(`BOM-${new Date().getFullYear()}-010`);
    });
  });

  describe("R4 locking", () => {
    it("refuses to replace lines of an approved BOM", async () => {
      bom.findFirst.mockResolvedValue({ ...draftProjectBom, status: "APPROVED" });
      await expect(service.replaceLines("b1", { lines: [] }, admin)).rejects.toThrow(/tạo phiên bản mới/);
    });

    it("refuses to rename an approved BOM", async () => {
      bom.findFirst.mockResolvedValue({ ...draftProjectBom, status: "APPROVED" });
      await expect(service.update("b1", { name: "Khác" }, admin)).rejects.toThrow(BadRequestException);
    });

    it("only allows a new version from an approved BOM", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      await expect(service.createNewVersion("b1", admin)).rejects.toThrow(/đã duyệt/);
    });

    it("bumps the MODEL version per product when creating a new version", async () => {
      bom.findFirst
        .mockResolvedValueOnce({ ...draftProjectBom, kind: "MODEL", status: "APPROVED", projectId: null, productId: "prod-1", version: 2 })
        .mockResolvedValueOnce(null); // code generation: no previous code
      bom.aggregate.mockResolvedValue({ _max: { version: 3 } });

      await service.createNewVersion("b1", admin);

      expect(bom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "MODEL", status: "DRAFT", version: 4, sourceBomId: "b1", productId: "prod-1" })
        })
      );
    });
  });

  describe("R5 free-text lines", () => {
    it("lists stock lines missing a material code when approving a MODEL", async () => {
      bom.findFirst.mockResolvedValue({ ...draftProjectBom, kind: "MODEL", projectId: null, productId: "prod" });
      bomLine.findMany.mockResolvedValue([
        { name: "Vít M5", group: "MECHANICAL", materialId: null, childBomId: null },
        { name: "Lập trình PLC", group: "SOFTWARE", materialId: null, childBomId: null },
        { name: "Cảm biến", group: "ELECTRICAL", materialId: "m1", childBomId: null }
      ]);
      await expect(service.approve("b1", admin)).rejects.toThrow("Các dòng sau chưa gắn mã vật tư: Vít M5");
    });

    it("allows approving a PROJECT BOM that still has free-text lines", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      bomLine.findMany.mockResolvedValue([{ name: "Vít M5", group: "MECHANICAL", materialId: null, childBomId: null }]);
      jest.spyOn(service as unknown as { buildDetail: () => Promise<unknown> }, "buildDetail").mockResolvedValue({});
      await service.approve("b1", admin);
      expect(bom.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }));
    });

    it("blocks save-as-model and names the lines without a material code", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      bomLine.findMany.mockResolvedValue([{ id: "l1", name: "Khung thép", group: "MECHANICAL", materialId: null, childBomId: null, quantity: 1, estUnitCost: 0 }]);
      await expect(service.saveAsModel("b1", { productId: "prod", source: "ESTIMATE" }, admin)).rejects.toThrow(/Khung thép/);
    });
  });

  describe("R6 sub-assemblies", () => {
    it("rejects a BOM containing itself", async () => {
      bom.findFirst.mockResolvedValue({ ...draftProjectBom, kind: "MODEL", projectId: null, productId: "prod" });
      await expect(
        service.replaceLines(
          "b1",
          { lines: [{ group: "OTHER", name: "Cụm", quantity: 1, estUnitCost: 0, childBomId: "b1" }] },
          admin
        )
      ).rejects.toThrow(/chính nó/);
    });

    it("rejects a sub-assembly that is not an approved model", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      bom.findMany.mockResolvedValue([]);
      await expect(
        service.replaceLines("b1", { lines: [{ group: "OTHER", name: "Cụm", quantity: 1, estUnitCost: 0, childBomId: "c1" }] }, admin)
      ).rejects.toThrow(/đã duyệt/);
    });

    it("detects a loop through the persisted graph", () => {
      const childrenOf = new Map([["B", ["A"]], ["C", []]]);
      expect(wouldCreateCycle("A", ["B"], childrenOf)).toBe(true);
      expect(wouldCreateCycle("A", ["C"], childrenOf)).toBe(false);
    });

    it("rejects a loop on save", async () => {
      bom.findFirst.mockResolvedValue({ ...draftProjectBom, id: "A", kind: "MODEL", projectId: null, productId: "prod" });
      bom.findMany.mockResolvedValue([{ id: "B" }]);
      // B contains A
      bomLine.findMany.mockResolvedValue([
        { id: "x", bomId: "B", order: 0, group: "OTHER", materialId: null, childBomId: "A", name: "n", unit: null, quantity: 1, estUnitCost: 0, material: null }
      ]);
      await expect(
        service.replaceLines("A", { lines: [{ group: "OTHER", name: "Cụm B", quantity: 1, estUnitCost: 0, childBomId: "B" }] }, admin)
      ).rejects.toThrow(/vòng lặp/);
    });
  });

  describe("R7 totals", () => {
    const line = (id: string, group: CostLineInput["group"], quantity: number, estUnitCost: number, childBomId: string | null = null): CostLineInput => ({
      id, group, quantity, estUnitCost, childBomId
    });

    it("sums quantity x unit cost by group, with sub-assemblies at quantity x child total", () => {
      const graph = new Map<string, CostLineInput[]>([
        ["root", [line("1", "MECHANICAL", 2, 1000), line("2", "ELECTRICAL", 3, 500, "child"), line("3", "ELECTRICAL", 1, 250)]],
        ["child", [line("c1", "OTHER", 4, 100), line("c2", "OTHER", 1, 600)]]
      ]);
      const totals = computeBomGraphTotals(graph);

      expect(totals.get("child")?.total).toBe(1000);
      expect(totals.get("root")?.total).toBe(2000 + 3000 + 250);
      expect(totals.get("root")?.byGroup).toEqual([
        { group: "MECHANICAL", amount: 2000 },
        { group: "ELECTRICAL", amount: 3250 }
      ]);
    });

    it("does not blow up on a cyclic graph", () => {
      const graph = new Map<string, CostLineInput[]>([
        ["a", [line("1", "OTHER", 1, 0, "b")]],
        ["b", [line("2", "OTHER", 1, 0, "a")]]
      ]);
      expect(() => computeBomGraphTotals(graph)).not.toThrow();
    });

    it("flags only stock-group free lines (R5 helper)", () => {
      expect(
        findLinesMissingMaterial([
          { name: "A", group: "VISION", materialId: null, childBomId: null },
          { name: "B", group: "LABOR", materialId: null, childBomId: null },
          { name: "C", group: "OTHER", materialId: null, childBomId: "x" }
        ])
      ).toEqual(["A"]);
    });
  });

  describe("R11 permissions and STAFF scoping", () => {
    it("hides a project BOM when the project is outside the STAFF scope", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      (prisma.project as Mocks).findFirst.mockResolvedValue(null);
      await expect(service.findOne("b1", staff)).rejects.toThrow(NotFoundException);
    });

    it("denies editing a MODEL BOM without materials.edit", async () => {
      bom.findFirst.mockResolvedValue({ ...draftProjectBom, kind: "MODEL", projectId: null, productId: "prod" });
      await expect(service.update("b1", { name: "Mẫu" }, staff)).rejects.toThrow(ForbiddenException);
    });

    it("denies editing a project BOM without projects.edit", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      const viewer: JwtUser = { ...staff, permissions: ["projects.view"] };
      await expect(service.update("b1", { name: "Khác" }, viewer)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("R12 deletion", () => {
    it("blocks deleting a BOM used by a quote line", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      (prisma.quoteItem as Mocks).count.mockResolvedValue(1);
      await expect(service.remove("b1", admin)).rejects.toThrow(/báo giá/);
    });

    it("blocks deleting a BOM used as a sub-assembly", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      bomLine.count.mockResolvedValue(1);
      await expect(service.remove("b1", admin)).rejects.toThrow(/cụm con/);
    });

    it("soft-deletes an unused BOM", async () => {
      bom.findFirst.mockResolvedValue(draftProjectBom);
      await service.remove("b1", admin);
      expect(bom.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { deletedAt: expect.any(Date) } });
    });
  });
});
