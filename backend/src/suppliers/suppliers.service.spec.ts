import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SuppliersService } from "./suppliers.service";

describe("SuppliersService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: SuppliersService;
  let prisma: {
    $transaction: jest.Mock;
    supplier: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
      supplier: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new SuppliersService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns paginated list with meta", async () => {
      const rows = [{ id: "s1", name: "NCC 1", code: "NCC001" }];
      prisma.supplier.findMany.mockResolvedValue(rows);
      prisma.supplier.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, user);

      expect(result.items).toEqual(rows);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it("filters by search term", async () => {
      prisma.supplier.findMany.mockResolvedValue([]);
      prisma.supplier.count.mockResolvedValue(0);

      await service.findAll({ search: "ABC", page: 1, limit: 10 }, user);

      const whereArg = prisma.supplier.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toBeDefined();
      expect(whereArg.OR[0].name.contains).toBe("ABC");
    });
  });

  describe("findOne", () => {
    it("returns supplier when found", async () => {
      const supplier = { id: "s1", name: "NCC 1", deletedAt: null };
      prisma.supplier.findFirst.mockResolvedValue(supplier);

      const result = await service.findOne("s1", user);

      expect(result).toEqual(supplier);
    });

    it("throws NotFoundException when not found", async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findOne("missing", user)).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("creates supplier and returns id + code + name", async () => {
      const created = { id: "s2", code: "NCC002", name: "NCC 2" };
      prisma.supplier.create.mockResolvedValue(created);

      const dto = { code: "NCC002", name: "NCC 2", isActive: true };
      const result = await service.create(dto, user);

      expect(result).toEqual(created);
      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: "NCC002", name: "NCC 2" }) })
      );
    });
  });

  describe("update", () => {
    it("throws NotFoundException if supplier does not exist", async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.update("missing", { name: "New" }, user)).rejects.toThrow(NotFoundException);
    });

    it("updates and returns result", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: "s1" });
      prisma.supplier.update.mockResolvedValue({ id: "s1", code: "NCC001", name: "Updated" });

      const result = await service.update("s1", { name: "Updated" }, user);

      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("soft-deletes the supplier", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: "s1" });
      prisma.supplier.update.mockResolvedValue({ id: "s1" });

      const result = await service.remove("s1", user);

      expect(result).toMatchObject({ success: true, id: "s1" });
      const updateData = prisma.supplier.update.mock.calls[0][0].data;
      expect(updateData.deletedAt).toBeInstanceOf(Date);
    });

    it("throws NotFoundException if not found", async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.remove("missing", user)).rejects.toThrow(NotFoundException);
    });
  });
});
