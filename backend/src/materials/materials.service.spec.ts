import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { MaterialsService } from "./materials.service";

describe("MaterialsService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: MaterialsService;
  let prisma: {
    $transaction: jest.Mock;
    material: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    materialSupplier: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fnOrArr) => {
        if (Array.isArray(fnOrArr)) return Promise.all(fnOrArr);
        return fnOrArr(prisma);
      }),
      material: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      materialSupplier: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    service = new MaterialsService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns paginated materials with meta", async () => {
      const rawItem = { id: "m1", name: "Cáp", code: "CAP001", unit: "m", salePrice: 50000, costPrice: 40000, minStock: null, isActive: true, stockBalances: [], category: null };
      prisma.material.findMany.mockResolvedValue([rawItem]);
      prisma.material.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, user);

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("marks isLowStock when totalStock < minStock", async () => {
      const rawItem = { id: "m1", name: "Van", code: "VAN001", unit: "cái", salePrice: 100000, costPrice: 80000, minStock: 10, isActive: true, stockBalances: [{ quantity: 5 }], category: null };
      prisma.material.findMany.mockResolvedValue([rawItem]);
      prisma.material.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, user);

      expect(result.items[0].isLowStock).toBe(true);
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when not found", async () => {
      prisma.material.findFirst.mockResolvedValue(null);

      await expect(service.findOne("missing", user)).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("creates material and returns id + code", async () => {
      const created = { id: "m2", code: "CAP002", name: "Cáp 2" };
      prisma.material.create.mockResolvedValue(created);

      const dto = { code: "CAP002", name: "Cáp 2", unit: "m", salePrice: 0, costPrice: 0, isActive: true };
      const result = await service.create(dto, user);

      expect(result).toEqual(created);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when material not found", async () => {
      prisma.material.findFirst.mockResolvedValue(null);

      await expect(service.update("missing", { name: "X" }, user)).rejects.toThrow(NotFoundException);
    });

    it("updates material fields", async () => {
      prisma.material.findFirst.mockResolvedValue({ id: "m1" });
      prisma.material.update.mockResolvedValue({ id: "m1", code: "CAP001", name: "Updated" });

      const result = await service.update("m1", { name: "Updated" }, user);

      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("soft-deletes the material", async () => {
      prisma.material.findFirst.mockResolvedValue({ id: "m1" });
      prisma.material.update.mockResolvedValue({ id: "m1" });

      const result = await service.remove("m1", user);

      expect(result.success).toBe(true);
      const updateData = prisma.material.update.mock.calls[0][0].data;
      expect(updateData.deletedAt).toBeInstanceOf(Date);
    });
  });
});
