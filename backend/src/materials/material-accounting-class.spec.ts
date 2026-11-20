import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { createMaterialSchema } from "./dto/create-material.dto";
import { materialFilterSchema } from "./dto/material-filter.dto";
import { updateMaterialSchema } from "./dto/update-material.dto";
import { resolveAccountingClass } from "./material-accounting-class";
import { MaterialsService } from "./materials.service";

describe("kind <-> accountingClass", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  describe("resolveAccountingClass", () => {
    it("SERVICE + RAW_MATERIAL is rejected", () => {
      expect(() => resolveAccountingClass("SERVICE", "RAW_MATERIAL")).toThrow(BadRequestException);
    });
    it("SERVICE always resolves to null", () => {
      expect(resolveAccountingClass("SERVICE", undefined, "RAW_MATERIAL")).toBeNull();
      expect(resolveAccountingClass("SERVICE", null)).toBeNull();
    });
    it("PRODUCT defaults to FINISHED_GOOD, STOCK defaults to RAW_MATERIAL", () => {
      expect(resolveAccountingClass("PRODUCT", undefined)).toBe("FINISHED_GOOD");
      expect(resolveAccountingClass("STOCK", undefined)).toBe("RAW_MATERIAL");
    });
    it("STOCK accepts an explicit class, and an existing class is kept when kind changes", () => {
      expect(resolveAccountingClass("STOCK", "TOOL")).toBe("TOOL");
      expect(resolveAccountingClass("PRODUCT", undefined, "MERCHANDISE")).toBe("MERCHANDISE");
    });
  });

  describe("DTOs", () => {
    it("accepts an old create payload without accountingClass", () => {
      const parsed = createMaterialSchema.parse({ code: "M1", name: "Cáp", unit: "m" });
      expect(parsed.kind).toBe("STOCK");
      expect(parsed.accountingClass).toBeUndefined();
    });
    it("update payload without kind/accountingClass leaves both undefined", () => {
      const parsed = updateMaterialSchema.parse({ name: "Tên mới" });
      expect(parsed.kind).toBeUndefined();
      expect(parsed.accountingClass).toBeUndefined();
    });
    it("filters by accountingClass and rejects unknown values", () => {
      expect(materialFilterSchema.parse({ accountingClass: "TOOL" }).accountingClass).toBe("TOOL");
      expect(materialFilterSchema.safeParse({ accountingClass: "XYZ" }).success).toBe(false);
    });
  });

  describe("MaterialsService", () => {
    let service: MaterialsService;
    let prisma: {
      $transaction: jest.Mock;
      material: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
    };

    beforeEach(() => {
      prisma = {
        $transaction: jest.fn().mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
        material: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: "m1", code: "M1", name: "X" }),
          update: jest.fn().mockResolvedValue({ id: "m1", code: "M1", name: "X" }),
        },
      };
      service = new MaterialsService(prisma as unknown as PrismaService);
    });

    it("create: old payload (kind STOCK default) stores RAW_MATERIAL", async () => {
      await service.create({ code: "M1", name: "Cáp", unit: "m", kind: "STOCK", salePrice: 0, costPrice: 0, isActive: true }, user);
      expect(prisma.material.create.mock.calls[0][0].data).toMatchObject({ kind: "STOCK", accountingClass: "RAW_MATERIAL" });
    });

    it("create: PRODUCT defaults to FINISHED_GOOD", async () => {
      await service.create({ code: "M1", name: "Máy", unit: "cái", kind: "PRODUCT", salePrice: 0, costPrice: 0, isActive: true }, user);
      expect(prisma.material.create.mock.calls[0][0].data.accountingClass).toBe("FINISHED_GOOD");
    });

    it("create: SERVICE + RAW_MATERIAL is rejected and nothing is written", async () => {
      await expect(
        service.create(
          { code: "M1", name: "Gia công", unit: "lần", kind: "SERVICE", accountingClass: "RAW_MATERIAL", salePrice: 0, costPrice: 0, isActive: true },
          user
        )
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.material.create).not.toHaveBeenCalled();
    });

    it("update: switching kind to SERVICE clears accountingClass", async () => {
      prisma.material.findFirst.mockResolvedValue({ id: "m1", kind: "STOCK", accountingClass: "RAW_MATERIAL" });
      await service.update("m1", { kind: "SERVICE" }, user);
      expect(prisma.material.update.mock.calls[0][0].data.accountingClass).toBeNull();
    });

    it("update: SERVICE material cannot get a class", async () => {
      prisma.material.findFirst.mockResolvedValue({ id: "m1", kind: "SERVICE", accountingClass: null });
      await expect(service.update("m1", { accountingClass: "TOOL" }, user)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("update: unrelated edit does not touch accountingClass (backward compatible)", async () => {
      prisma.material.findFirst.mockResolvedValue({ id: "m1", kind: "STOCK", accountingClass: "TOOL" });
      await service.update("m1", { name: "Tên mới" }, user);
      expect(prisma.material.update.mock.calls[0][0].data).not.toHaveProperty("accountingClass");
    });

    it("list: filters by accountingClass and returns it on each row", async () => {
      prisma.material.findMany.mockResolvedValue([
        { id: "m1", code: "M1", name: "A", unit: "c", kind: "STOCK", accountingClass: "TOOL", salePrice: 0, costPrice: 0, minStock: null, stockBalances: [], category: null },
      ]);
      prisma.material.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 10, accountingClass: "TOOL" }, user);
      expect(prisma.material.findMany.mock.calls[0][0].where.accountingClass).toBe("TOOL");
      expect(result.items[0].accountingClass).toBe("TOOL");
    });

    it("bulkUpdateClasses reports each row; a kind violation fails only that row", async () => {
      prisma.material.findMany.mockResolvedValue([
        { id: "m1", code: "A", kind: "STOCK", accountingClass: "RAW_MATERIAL" },
        { id: "m2", code: "B", kind: "SERVICE", accountingClass: null },
        { id: "m3", code: "C", kind: "STOCK", accountingClass: "TOOL" },
      ]);
      const out = await service.bulkUpdateClasses(
        {
          items: [
            { materialId: "m1", accountingClass: "MERCHANDISE" },
            { materialId: "m2", accountingClass: "RAW_MATERIAL" },
            { materialId: "m3", accountingClass: "TOOL" },
            { materialId: "zz", accountingClass: "TOOL" },
          ],
        },
        user
      );
      expect(out.results.map((r) => r.status)).toEqual(["UPDATED", "ERROR", "UNCHANGED", "NOT_FOUND"]);
      expect(out.results[1].message).toContain("Dịch vụ");
      expect(prisma.material.update).toHaveBeenCalledTimes(1);
    });
  });
});
