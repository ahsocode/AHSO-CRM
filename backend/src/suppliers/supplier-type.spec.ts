import { PrismaService } from "../common/prisma.service";
import { bulkSupplierTypeSchema } from "./dto/bulk-supplier-type.dto";
import { createSupplierSchema } from "./dto/create-supplier.dto";
import { supplierFilterSchema } from "./dto/supplier-filter.dto";
import { SuppliersService, matchExpenseKeyword } from "./suppliers.service";

describe("supplierType", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  let service: SuppliersService;
  let prisma: {
    $transaction: jest.Mock;
    supplier: { findMany: jest.Mock; findFirst: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockImplementation((arg) => Promise.all(arg)),
      supplier: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "s1", code: "S1", name: "N" }),
        update: jest.fn().mockResolvedValue({ id: "s1", code: "S1", name: "N" }),
      },
    };
    service = new SuppliersService(prisma as unknown as PrismaService);
  });

  it("old create payload (no supplierType) still parses and is stored as GOODS", async () => {
    const dto = createSupplierSchema.parse({ code: "S1", name: "Nhà cung cấp" });
    await service.create(dto, user);
    expect(prisma.supplier.create.mock.calls[0][0].data.supplierType).toBe("GOODS");
  });

  it("create/update/list accept and apply supplierType", async () => {
    await service.create({ code: "S1", name: "Grab VN", supplierType: "EXPENSE", isActive: true }, user);
    expect(prisma.supplier.create.mock.calls[0][0].data.supplierType).toBe("EXPENSE");

    prisma.supplier.findFirst.mockResolvedValue({ id: "s1", code: "S1", deletedAt: null });
    await service.update("s1", { supplierType: "SERVICE" }, user);
    expect(prisma.supplier.update.mock.calls[0][0].data.supplierType).toBe("SERVICE");

    await service.findAll({ page: 1, limit: 10, supplierType: "EXPENSE" }, user);
    expect(prisma.supplier.findMany.mock.calls[0][0].where.supplierType).toBe("EXPENSE");
  });

  it("update without supplierType leaves it untouched", async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: "s1", code: "S1", deletedAt: null });
    await service.update("s1", { name: "Tên mới" }, user);
    expect(prisma.supplier.update.mock.calls[0][0].data).not.toHaveProperty("supplierType");
  });

  it("filter schema rejects unknown types", () => {
    expect(supplierFilterSchema.safeParse({ supplierType: "BAD" }).success).toBe(false);
  });

  it("bulkUpdateType returns one result per row", async () => {
    prisma.supplier.findMany.mockResolvedValue([
      { id: "a", code: "A", name: "A", supplierType: "GOODS" },
      { id: "b", code: "B", name: "B", supplierType: "EXPENSE" },
    ]);
    const parsed = bulkSupplierTypeSchema.parse([
      { supplierId: "a", supplierType: "EXPENSE" },
      { supplierId: "b", supplierType: "EXPENSE" },
      { supplierId: "x", supplierType: "SERVICE" },
    ]) as Parameters<SuppliersService["bulkUpdateType"]>[0];

    const out = await service.bulkUpdateType(parsed, user);

    expect(out.results.map((r) => r.status)).toEqual(["UPDATED", "UNCHANGED", "NOT_FOUND"]);
    expect(out.results[0]).toMatchObject({ from: "GOODS", to: "EXPENSE" });
    expect(prisma.supplier.update).toHaveBeenCalledTimes(1);
  });

  it("suggestExpenseSuppliers only proposes (reads GOODS suppliers, writes nothing)", async () => {
    prisma.supplier.findMany.mockResolvedValue([
      { id: "1", code: "S1", name: "Grab Việt Nam", taxCode: null },
      { id: "2", code: "S2", name: "Công ty Cơ khí An Phát", taxCode: null },
      { id: "3", code: "S3", name: "VNPT Hà Nội", taxCode: null },
    ]);
    const out = await service.suggestExpenseSuppliers();
    expect(out.map((r) => r.code)).toEqual(["S1", "S3"]);
    expect(out[0].suggestedType).toBe("EXPENSE");
    expect(prisma.supplier.update).not.toHaveBeenCalled();
    expect(matchExpenseKeyword("Xăng dầu Petrolimex")).toBe("xăng");
  });
});
