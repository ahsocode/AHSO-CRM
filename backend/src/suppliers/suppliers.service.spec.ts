import { ConflictException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { updateSupplierSchema } from "./dto/update-supplier.dto";
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
    stockReceipt: {
      count: jest.Mock;
      aggregate: jest.Mock;
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
      stockReceipt: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    service = new SuppliersService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("returns paginated list with meta and a server-side active count", async () => {
      const rows = [{ id: "s1", name: "NCC 1", code: "NCC001" }];
      prisma.supplier.findMany.mockResolvedValue(rows);
      prisma.supplier.count.mockResolvedValueOnce(1).mockResolvedValueOnce(42);

      const result = await service.findAll({ page: 1, limit: 10 }, user);

      expect(result.items).toEqual(rows);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
      // Card "Đang hoạt động" must count all pages, not just the 10 visible rows
      expect(result.meta.summary.activeCount).toBe(42);
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
    const rawSupplier = {
      id: "s1",
      code: "NCC001",
      name: "NCC 1",
      deletedAt: null,
      materialSuppliers: [
        {
          id: "ms1",
          supplierCode: "SP-01",
          costPrice: new Decimal(125000),
          leadTimeDays: 7,
          isPreferred: true,
          material: { id: "m1", code: "VT001", name: "Cáp điện", unit: "m" },
        },
      ],
      receipts: [
        {
          id: "r1",
          receiptNo: "PN-001",
          date: new Date("2026-10-01"),
          status: "CONFIRMED",
          totalAmount: new Decimal(5_000_000),
          purchaseInvoiceNo: "HD-9",
          warehouse: { id: "w1", name: "Kho chính" },
        },
      ],
    };

    it("returns the detail contract the frontend page renders (_count, stats, materials, receipts)", async () => {
      // Regression: findOne used to return the bare row without `_count`,
      // and the detail page crashed reading `_count.materialSuppliers`.
      prisma.supplier.findFirst.mockResolvedValue(rawSupplier);
      prisma.stockReceipt.count.mockResolvedValue(3);
      prisma.stockReceipt.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Decimal(12_500_000) },
        _max: { date: new Date("2026-10-01") },
      });

      const result = await service.findOne("s1", user);

      expect(result._count).toEqual({ materialSuppliers: 1, receipts: 3 });
      expect(result.stats.confirmedPurchaseTotal).toBe(12_500_000);
      expect(result.materials[0]).toMatchObject({
        materialId: "m1",
        materialName: "Cáp điện",
        costPrice: 125000,
        isPreferred: true,
      });
      expect(result.recentReceipts[0]).toMatchObject({ receiptNo: "PN-001", totalAmount: 5_000_000 });
      // Decimals must be plain numbers for JSON consumers
      expect(typeof result.materials[0].costPrice).toBe("number");
      // Raw relation arrays are not leaked alongside the mapped ones
      expect(result).not.toHaveProperty("materialSuppliers");
      expect(result).not.toHaveProperty("receipts");
    });

    it("returns zero stats when the supplier has no confirmed receipts", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ ...rawSupplier, materialSuppliers: [], receipts: [] });
      prisma.stockReceipt.count.mockResolvedValue(0);
      prisma.stockReceipt.aggregate.mockResolvedValue({ _sum: { totalAmount: null }, _max: { date: null } });

      const result = await service.findOne("s1", user);

      expect(result._count).toEqual({ materialSuppliers: 0, receipts: 0 });
      expect(result.stats).toEqual({ confirmedPurchaseTotal: 0, lastReceiptDate: null });
    });

    it("throws NotFoundException when not found", async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findOne("missing", user)).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("creates supplier and returns id + code + name", async () => {
      const created = { id: "s2", code: "NCC002", name: "NCC 2" };
      prisma.supplier.findFirst.mockResolvedValue(null);
      prisma.supplier.create.mockResolvedValue(created);

      const dto = { code: "NCC002", name: "NCC 2", isActive: true };
      const result = await service.create(dto, user);

      expect(result).toEqual(created);
      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: "NCC002", name: "NCC 2" }) })
      );
    });

    it("rejects a duplicate code with a readable 409 instead of a raw Prisma error", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: "other", deletedAt: null });

      await expect(service.create({ code: "NCC001", name: "Trùng", isActive: true }, user)).rejects.toThrow(
        ConflictException
      );
      expect(prisma.supplier.create).not.toHaveBeenCalled();
    });

    it("explains when the code belongs to a soft-deleted supplier", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: "old", deletedAt: new Date() });

      await expect(service.create({ code: "NCC001", name: "Mới", isActive: true }, user)).rejects.toThrow(
        /đã xóa/
      );
    });
  });

  describe("update", () => {
    it("throws NotFoundException if supplier does not exist", async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.update("missing", { name: "New" }, user)).rejects.toThrow(NotFoundException);
    });

    it("updates and returns result", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: "s1", code: "NCC001" });
      prisma.supplier.update.mockResolvedValue({ id: "s1", code: "NCC001", name: "Updated" });

      const result = await service.update("s1", { name: "Updated" }, user);

      expect(result.name).toBe("Updated");
    });

    it("clears optional fields when the form sends empty strings", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ id: "s1", code: "NCC001" });
      prisma.supplier.update.mockResolvedValue({ id: "s1", code: "NCC001", name: "NCC 1" });

      // Same path as the HTTP layer: ZodValidationPipe parses the body first
      const dto = updateSupplierSchema.parse({ phone: "", email: "", address: "  " });
      await service.update("s1", dto, user);

      const data = prisma.supplier.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ phone: null, email: null, address: null });
      // Untouched fields stay out of the update
      expect(data).not.toHaveProperty("name");
      expect(data).not.toHaveProperty("taxCode");
    });

    it("checks code uniqueness only when the code actually changes", async () => {
      prisma.supplier.findFirst
        .mockResolvedValueOnce({ id: "s1", code: "NCC001" }) // load target
        .mockResolvedValueOnce({ id: "s2", deletedAt: null }); // conflicting row

      await expect(service.update("s1", { code: "NCC002" }, user)).rejects.toThrow(ConflictException);
      expect(prisma.supplier.update).not.toHaveBeenCalled();
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

  describe("exportAll", () => {
    it("exports every row matching filters without the 100-row pagination cap", async () => {
      prisma.supplier.findMany.mockResolvedValue([
        { code: "NCC001", name: "A", taxCode: null, address: null, phone: null, email: null, contactName: null, notes: null, isActive: true },
      ]);

      const result = await service.exportAll({ page: 1, limit: 10, isActive: true });

      const args = prisma.supplier.findMany.mock.calls[0][0];
      expect(args.skip).toBeUndefined();
      expect(args.where).toMatchObject({ deletedAt: null, isActive: true });
      expect(result.items[0]["Mã NCC"]).toBe("NCC001");
    });
  });
});
