import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { WarehousesService } from "./warehouses.service";

describe("WarehousesService", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };

  let service: WarehousesService;
  let prisma: {
    $transaction: jest.Mock;
    warehouse: {
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
      warehouse: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new WarehousesService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns warehouses with meta", async () => {
      prisma.warehouse.findMany.mockResolvedValue([{ id: "w1", name: "Kho Hà Nội", code: "KHN" }]);
      prisma.warehouse.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, user);

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe("findOne", () => {
    it("throws NotFoundException when not found", async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.findOne("missing", user)).rejects.toThrow(NotFoundException);
    });

    it("returns warehouse when found", async () => {
      const wh = { id: "w1", name: "Kho Hà Nội", code: "KHN", stockBalances: [] };
      prisma.warehouse.findFirst.mockResolvedValue(wh);

      const result = await service.findOne("w1", user);

      expect(result).toMatchObject({ id: "w1" });
    });
  });

  describe("create", () => {
    it("creates warehouse", async () => {
      prisma.warehouse.create.mockResolvedValue({ id: "w2", code: "KHB", name: "Kho HCM" });

      const result = await service.create({ code: "KHB", name: "Kho HCM", isActive: true }, user);

      expect(result.code).toBe("KHB");
    });
  });

  describe("remove", () => {
    it("soft-deletes warehouse", async () => {
      prisma.warehouse.findFirst.mockResolvedValue({ id: "w1" });
      prisma.warehouse.update.mockResolvedValue({ id: "w1" });

      const result = await service.remove("w1", user);

      expect(result.success).toBe(true);
      const data = prisma.warehouse.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
    });

    it("throws NotFoundException if not found", async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.remove("missing", user)).rejects.toThrow(NotFoundException);
    });
  });
});
