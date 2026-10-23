import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { DocumentsService } from "../documents/documents.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { ProjectsService } from "./projects.service";

describe("ProjectsService material allocations (multi-allocation)", () => {
  const user = { sub: "u1", email: "a@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  const salesDate = new Date("2026-06-30");

  let service: ProjectsService;
  let tx: Record<string, Record<string, jest.Mock> | jest.Mock>;
  let prisma: Record<string, unknown>;
  let inventoryBalance: { adjustBalance: jest.Mock; ensureSufficientStock: jest.Mock };

  const emptyAllocation = (overrides: Record<string, unknown> = {}) => ({
    id: "alloc-2",
    projectId: "p1",
    salesInvoiceDate: salesDate,
    salesInvoiceNo: "HD-02",
    status: "DRAFT",
    notes: null,
    confirmedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    costs: [],
    stockIssues: [],
    ...overrides
  });

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn(),
      stockLot: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "lot-1",
            warehouseId: "wh-1",
            materialId: "mat-1",
            purchaseInvoiceDate: new Date("2026-05-01"),
            remainingQuantity: 10,
            unitPrice: 1000
          }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      bomLine: { findMany: jest.fn().mockResolvedValue([{ id: "line-1", materialId: "mat-1" }]) },
      projectCost: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      projectMaterialAllocation: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "alloc-2" }),
        update: jest.fn().mockResolvedValue({ id: "alloc-2" }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(emptyAllocation())
      },
      stockIssue: { create: jest.fn() },
      project: { update: jest.fn() }
    };
    prisma = {
      ...tx,
      $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) => fn(tx)),
      project: { findFirst: jest.fn().mockResolvedValue({ id: "p1", status: "DELIVERING" }) }
    };
    inventoryBalance = { adjustBalance: jest.fn(), ensureSufficientStock: jest.fn() };
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as CustomFieldsService,
      {} as DomainEventsService,
      {} as DocumentsService,
      inventoryBalance as unknown as InventoryBalanceService
    );
  });

  const dto = {
    salesInvoiceDate: salesDate,
    salesInvoiceNo: "HD-02",
    items: [{ stockLotId: "lot-1", quantity: 4, bomLineId: "line-1" }]
  };

  it("creates an extra allocation for a project that is not completed yet", async () => {
    const result = await service.createMaterialAllocation("p1", dto, user);

    const alloc = tx.projectMaterialAllocation as Record<string, jest.Mock>;
    expect(alloc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          salesInvoiceNo: "HD-02",
          items: { create: [expect.objectContaining({ stockLotId: "lot-1", bomLineId: "line-1" })] }
        })
      })
    );
    expect(result.id).toBe("alloc-2");
    expect(result.salesInvoiceNo).toBe("HD-02");
  });

  it("rejects a bomLineId whose material differs from the lot (R-line check)", async () => {
    (tx.bomLine as Record<string, jest.Mock>).findMany.mockResolvedValue([{ id: "line-1", materialId: "other" }]);
    await expect(service.createMaterialAllocation("p1", dto, user)).rejects.toThrow(BadRequestException);
  });

  it("rejects attaching a cost invoiced after the sales invoice (R9)", async () => {
    (tx.projectCost as Record<string, jest.Mock>).findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "c1", description: "Gia công", invoiceDate: new Date("2026-07-15"), allocationId: null }
      ]);
    await expect(service.createMaterialAllocation("p1", { ...dto, costIds: ["c1"] }, user)).rejects.toThrow(
      /sau ngày hóa đơn bán ra/
    );
  });

  it("legacy singular upsert still requires a completed project", async () => {
    await expect(service.upsertMaterialAllocation("p1", dto, user)).rejects.toThrow(
      "Chỉ phân bổ vật tư sau khi dự án đã hoàn thành"
    );
  });

  it("cancels a draft allocation and releases its costs", async () => {
    (prisma.projectMaterialAllocation as Record<string, jest.Mock>).findFirst.mockResolvedValue({
      id: "alloc-2",
      projectId: "p1",
      status: "DRAFT"
    });
    (tx.projectMaterialAllocation as Record<string, jest.Mock>).update.mockResolvedValue(
      emptyAllocation({ status: "CANCELLED" })
    );

    const result = await service.cancelMaterialAllocation("alloc-2", user);

    expect((tx.projectCost as Record<string, jest.Mock>).updateMany).toHaveBeenCalledWith({
      where: { allocationId: "alloc-2" },
      data: { allocationId: null }
    });
    expect(result.status).toBe("CANCELLED");
  });

  it("refuses to cancel a confirmed allocation", async () => {
    (prisma.projectMaterialAllocation as Record<string, jest.Mock>).findFirst.mockResolvedValue({
      id: "alloc-1",
      projectId: "p1",
      status: "CONFIRMED"
    });
    await expect(service.cancelMaterialAllocation("alloc-1", user)).rejects.toThrow(/đã xác nhận/);
  });

  it("confirms the requested allocation by id and issues stock per warehouse", async () => {
    const findFirst = (tx.projectMaterialAllocation as Record<string, jest.Mock>).findFirst;
    findFirst
      .mockResolvedValueOnce({ id: "alloc-2", projectId: "p1", status: "DRAFT" })
      .mockResolvedValueOnce({
        id: "alloc-2",
        projectId: "p1",
        salesInvoiceDate: salesDate,
        notes: null,
        project: { id: "p1" },
        items: [
          {
            stockLotId: "lot-1",
            warehouseId: "wh-1",
            materialId: "mat-1",
            quantity: 4,
            unitPrice: 1000,
            total: 4000,
            material: { name: "Cáp" }
          }
        ]
      });
    (tx.projectMaterialAllocation as Record<string, jest.Mock>).update.mockResolvedValue(
      emptyAllocation({ status: "CONFIRMED" })
    );
    (tx.stockIssue as Record<string, jest.Mock>).create.mockResolvedValue({});
    (tx.stockIssue as Record<string, jest.Mock>).findFirst = jest.fn().mockResolvedValue(null);

    const result = await service.confirmMaterialAllocationById("alloc-2", user);

    expect(inventoryBalance.adjustBalance).toHaveBeenCalled();
    expect((tx.stockIssue as Record<string, jest.Mock>).create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("CONFIRMED");
  });
});
