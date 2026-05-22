import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { MaterialCategoriesService } from "./material-categories.service";

describe("MaterialCategoriesService", () => {
  let service: MaterialCategoriesService;
  let prisma: {
    materialCategory: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      materialCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new MaterialCategoriesService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns all categories", async () => {
      const rows = [{ id: "c1", name: "Cáp", code: "CAP", parentId: null, parent: null, _count: { materials: 3 } }];
      prisma.materialCategory.findMany.mockResolvedValue(rows);

      const result = await service.findAll();

      expect(result).toEqual(rows);
      expect(prisma.materialCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: "asc" } })
      );
    });
  });

  describe("create", () => {
    it("creates category and returns id + code + name", async () => {
      const created = { id: "c2", code: "VAN", name: "Van" };
      prisma.materialCategory.create.mockResolvedValue(created);

      const result = await service.create({ code: "VAN", name: "Van" });

      expect(result).toEqual(created);
    });
  });

  describe("update", () => {
    it("throws NotFoundException if category not found", async () => {
      prisma.materialCategory.findUnique.mockResolvedValue(null);

      await expect(service.update("missing", { name: "X" })).rejects.toThrow(NotFoundException);
    });

    it("updates the category", async () => {
      prisma.materialCategory.findUnique.mockResolvedValue({ id: "c1" });
      prisma.materialCategory.update.mockResolvedValue({ id: "c1", code: "CAP", name: "Updated" });

      const result = await service.update("c1", { name: "Updated" });

      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("throws BadRequestException when category has materials", async () => {
      prisma.materialCategory.findUnique.mockResolvedValue({
        id: "c1",
        _count: { materials: 2 },
      });

      await expect(service.remove("c1")).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when category not found", async () => {
      prisma.materialCategory.findUnique.mockResolvedValue(null);

      await expect(service.remove("missing")).rejects.toThrow(NotFoundException);
    });

    it("deletes when no materials are using the category", async () => {
      prisma.materialCategory.findUnique.mockResolvedValue({
        id: "c1",
        _count: { materials: 0 },
      });
      prisma.materialCategory.delete.mockResolvedValue({ id: "c1" });

      const result = await service.remove("c1");

      expect(result).toMatchObject({ success: true });
    });
  });
});
