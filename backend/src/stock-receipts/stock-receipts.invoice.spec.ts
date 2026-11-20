import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { StockReceiptsService } from "./stock-receipts.service";
import { bulkReceiptInvoicesSchema } from "./dto/invoice-fields.dto";

type Mock = jest.Mock;

describe("StockReceiptsService - invoice, supplier type, project lots", () => {
  const user = { sub: "admin-1", email: "admin@ahso.vn", name: "Admin", role: "ADMIN" as const, permissions: [] };
  const baseDto = {
    warehouseId: "wh-1",
    date: new Date("2026-11-01T00:00:00.000Z"),
    items: [{ materialId: "mat-1", quantity: 2, unitPrice: 1000 }],
  };
  const invoice = { sellerTaxCode: "0312345678", invoiceSeries: "C26TAA", invoiceNumber: "0000123" };

  let service: StockReceiptsService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  let inventoryBalance: { adjustBalance: Mock; updateAverageCostPrice: Mock };
  let prisma: {
    $transaction: Mock;
    $executeRaw: Mock;
    stockReceipt: { findFirst: Mock; findMany: Mock; create: Mock; update: Mock; count: Mock };
    supplier: { findFirst: Mock };
    project: { findMany: Mock };
    stockLot: { create: Mock; findMany: Mock; updateMany: Mock };
    setting: { findUnique: Mock };
  };

  beforeEach(() => {
    inventoryBalance = {
      adjustBalance: jest.fn().mockResolvedValue(undefined),
      updateAverageCostPrice: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      stockReceipt: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "r-new", receiptNo: "PN-2026-001" }),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: "r1", receiptNo: "PN-2026-001", ...data })),
        count: jest.fn(),
      },
      supplier: { findFirst: jest.fn() },
      setting: { findUnique: jest.fn().mockResolvedValue(null) },
      project: { findMany: jest.fn().mockResolvedValue([]) },
      stockLot: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: typeof prisma) => unknown)(prisma)
    );
    service = new StockReceiptsService(
      prisma as unknown as PrismaService,
      inventoryBalance as unknown as InventoryBalanceService,
      audit as unknown as AuditService
    );
  });

  describe("backward compatibility", () => {
    it("creates a receipt from an old payload that has none of the new fields", async () => {
      const result = await service.create({ ...baseDto, purchaseInvoiceNo: "HD-OLD-1" } as never, user);

      expect(result).toEqual({ id: "r-new", receiptNo: "PN-2026-001" });
      const data = prisma.stockReceipt.create.mock.calls[0][0].data;
      expect(data.purchaseInvoiceNo).toBe("HD-OLD-1");
      expect(data.invoiceNumber).toBeUndefined();
      expect(prisma.supplier.findFirst).not.toHaveBeenCalled();
    });

    it("confirm uses receipt.date for the lot when there is no structured invoice date", async () => {
      const date = new Date("2026-10-10T00:00:00.000Z");
      prisma.stockReceipt.findFirst.mockResolvedValue({
        id: "r1", warehouseId: "wh-1", date, invoiceDate: null, purchaseInvoiceNo: null, supplier: null,
        items: [{ id: "i1", materialId: "mat-1", quantity: new Decimal(2), unitPrice: new Decimal(1000), projectId: null }],
      });
      prisma.stockReceipt.update.mockResolvedValue({ id: "r1", receiptNo: "PN-1", status: "CONFIRMED" });

      await service.confirm("r1", user);

      const lot = prisma.stockLot.create.mock.calls[0][0].data;
      expect(lot.purchaseInvoiceDate).toBe(date);
      expect(lot.projectId).toBeUndefined();
    });
  });

  describe("duplicate invoice guard", () => {
    it("returns 409 carrying the id and number of the existing receipt", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValueOnce({ id: "r-old", receiptNo: "PN-2026-005" });

      const error = await service.create({ ...baseDto, ...invoice } as never, user).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ existingReceiptId: "r-old", existingReceiptNo: "PN-2026-005" });
      expect(prisma.stockReceipt.create).not.toHaveBeenCalled();
    });

    it("ignores CANCELLED and deleted receipts when checking (they free the invoice number)", async () => {
      await service.create({ ...baseDto, ...invoice } as never, user);

      expect(prisma.stockReceipt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: "CANCELLED" }, deletedAt: null, ...invoice }),
        })
      );
      expect(prisma.stockReceipt.create).toHaveBeenCalled(); // no existing active receipt -> created
    });

    it("maps a DB unique violation (race) to the same 409 format", async () => {
      // pre-check passes (returns null), insert then fails on the partial unique index
      prisma.stockReceipt.create.mockRejectedValue({ code: "P2002", meta: { target: "StockReceipt_invoice_active_key" } });
      prisma.stockReceipt.findFirst
        .mockResolvedValueOnce(null) // pre-check
        .mockResolvedValueOnce(null) // receipt number generation
        .mockResolvedValueOnce({ id: "r-winner", receiptNo: "PN-2026-009" }); // lookup after failure

      const error = await service.create({ ...baseDto, ...invoice } as never, user).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ existingReceiptId: "r-winner", existingReceiptNo: "PN-2026-009" });
    });

    it("does not swallow unrelated unique errors", async () => {
      prisma.stockReceipt.create.mockRejectedValue({ code: "P2002", meta: { target: ["receiptNo"] } });

      await expect(service.create({ ...baseDto } as never, user)).rejects.toMatchObject({ code: "P2002" });
    });

    it("falls back to the supplier tax code and builds purchaseInvoiceNo from series-number", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ name: "Cty A", supplierType: "GOODS", taxCode: "0312 345 678" });

      await service.create(
        { ...baseDto, supplierId: "s1", invoiceSeries: "C26TAA", invoiceNumber: "0000123" } as never,
        user
      );

      const data = prisma.stockReceipt.create.mock.calls[0][0].data;
      expect(data.sellerTaxCode).toBe("0312345678");
      expect(data.purchaseInvoiceNo).toBe("C26TAA-0000123");
    });
  });

  describe("supplier type gate", () => {
    it.each(["SERVICE", "EXPENSE"])("rejects a %s supplier with 400", async (type) => {
      prisma.supplier.findFirst.mockResolvedValue({ name: "Grab", supplierType: type, taxCode: null });

      const error = await service.create({ ...baseDto, supplierId: "s1" } as never, user).catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain("không phải hàng hóa, không nhập kho");
      expect(prisma.stockReceipt.create).not.toHaveBeenCalled();
    });

    it("allows an OTHER supplier but returns a warning", async () => {
      prisma.supplier.findFirst.mockResolvedValue({ name: "Cty Khác", supplierType: "OTHER", taxCode: null });

      const result = (await service.create({ ...baseDto, supplierId: "s1" } as never, user)) as { warnings?: string[] };

      expect(result.warnings).toHaveLength(1);
      expect(prisma.stockReceipt.create).toHaveBeenCalled();
    });

    it("blocks confirm when the supplier was re-typed to EXPENSE after the draft was saved", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue({
        id: "r1", warehouseId: "wh-1", date: new Date(), items: [],
        supplier: { name: "Grab", supplierType: "EXPENSE" },
      });

      await expect(service.confirm("r1", user)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.stockLot.create).not.toHaveBeenCalled();
    });
  });

  describe("project-tagged lots", () => {
    it("copies item.projectId to StockLot.projectId on confirm", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValue({
        id: "r1", warehouseId: "wh-1", date: new Date(), invoiceDate: null, purchaseInvoiceNo: null, supplier: null,
        items: [{ id: "i1", materialId: "mat-1", quantity: new Decimal(2), unitPrice: new Decimal(1000), projectId: "proj-A" }],
      });
      prisma.stockReceipt.update.mockResolvedValue({ id: "r1", status: "CONFIRMED" });

      await service.confirm("r1", user);

      expect(prisma.stockLot.create.mock.calls[0][0].data.projectId).toBe("proj-A");
    });

    it("uses invoiceDate as the lot purchase invoice date when present", async () => {
      const invoiceDate = new Date("2026-09-30T00:00:00.000Z");
      prisma.stockReceipt.findFirst.mockResolvedValue({
        id: "r1", warehouseId: "wh-1", date: new Date("2026-11-01T00:00:00.000Z"), invoiceDate, purchaseInvoiceNo: "X-1",
        supplier: null,
        items: [{ id: "i1", materialId: "mat-1", quantity: new Decimal(1), unitPrice: new Decimal(10), projectId: null }],
      });
      prisma.stockReceipt.update.mockResolvedValue({ id: "r1", status: "CONFIRMED" });

      await service.confirm("r1", user);

      expect(prisma.stockLot.create.mock.calls[0][0].data.purchaseInvoiceDate).toBe(invoiceDate);
    });

    it("rejects an unknown project on a line", async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await expect(
        service.create({ ...baseDto, items: [{ materialId: "m", quantity: 1, unitPrice: 1, projectId: "nope" }] } as never, user)
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("updateInvoice (PATCH /:id/invoice)", () => {
    const confirmed = {
      id: "r1", receiptNo: "PN-2026-001", status: "CONFIRMED", date: new Date("2026-10-01T00:00:00.000Z"),
      invoiceDate: null, purchaseInvoiceNo: null, invoiceSeries: null, invoiceNumber: null, sellerTaxCode: null,
      invoiceFileRef: null, invoiceLookupCode: null, invoiceType: "NORMAL", relatedInvoiceRef: null,
      supplier: { taxCode: null },
    };

    it("edits a CONFIRMED receipt without touching items, quantities or balances", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValueOnce(confirmed).mockResolvedValue(null);
      prisma.stockLot.findMany.mockResolvedValue([
        { id: "l1", receivedQuantity: new Decimal(5), remainingQuantity: new Decimal(5) },
      ]);
      prisma.stockLot.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateInvoice("r1", { ...invoice, invoiceDate: new Date("2026-09-20T00:00:00.000Z") }, user);

      const data = prisma.stockReceipt.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("items");
      expect(data).not.toHaveProperty("totalAmount");
      expect(data.invoiceNumber).toBe("0000123");
      expect(data.purchaseInvoiceNo).toBe("C26TAA-0000123");
      expect(inventoryBalance.adjustBalance).not.toHaveBeenCalled();
      expect(inventoryBalance.updateAverageCostPrice).not.toHaveBeenCalled();
      expect(prisma.stockLot.updateMany.mock.calls[0][0].data.purchaseInvoiceDate).toEqual(new Date("2026-09-20T00:00:00.000Z"));
      expect(result.lotsUpdated).toBe(1);
    });

    it("refuses to move the invoice date when a lot was partly consumed", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValueOnce(confirmed);
      prisma.stockLot.findMany.mockResolvedValue([
        { id: "l1", receivedQuantity: new Decimal(5), remainingQuantity: new Decimal(3) },
      ]);

      const error = await service.updateInvoice("r1", { invoiceDate: new Date("2026-09-20T00:00:00.000Z") }, user).catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain("đã được xuất");
      expect(prisma.stockReceipt.update).not.toHaveBeenCalled();
    });

    it("allows invoice number edits on consumed lots when the date is unchanged", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValueOnce(confirmed).mockResolvedValue(null);
      prisma.stockLot.findMany.mockResolvedValue([
        { id: "l1", receivedQuantity: new Decimal(5), remainingQuantity: new Decimal(1) },
      ]);

      await expect(service.updateInvoice("r1", invoice, user)).resolves.toBeDefined();
    });

    it("rejects a CANCELLED receipt", async () => {
      prisma.stockReceipt.findFirst.mockResolvedValueOnce({ ...confirmed, status: "CANCELLED" });

      await expect(service.updateInvoice("r1", invoice, user)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("returns 409 when the invoice already belongs to another receipt", async () => {
      prisma.stockReceipt.findFirst
        .mockResolvedValueOnce(confirmed)
        .mockResolvedValueOnce({ id: "r-other", receiptNo: "PN-2026-002" });

      const error = await service.updateInvoice("r1", invoice, user).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      // the duplicate check must exclude the receipt being edited
      expect(prisma.stockReceipt.findFirst.mock.calls[1][0].where.id).toEqual({ not: "r1" });
    });
  });

  describe("bulkUpdateInvoices", () => {
    it("returns a result per row and does not stop at a failing row", async () => {
      const row = (n: string) => ({ ...invoice, invoiceNumber: n });
      const parsed = bulkReceiptInvoicesSchema.parse([
        { receiptId: "r1", ...row("1") },
        { receiptId: "r2", ...row("2") },
        { receiptNo: "PN-MISSING", ...row("3") },
        { receiptId: "r4", ...row("4") },
      ]) as Parameters<StockReceiptsService["bulkUpdateInvoices"]>[0];

      const spy = jest.spyOn(service, "updateInvoice");
      spy
        .mockResolvedValueOnce({ id: "r1", receiptNo: "PN-1" } as never)
        .mockRejectedValueOnce(new ConflictException({ message: "dup", existingReceiptId: "rx", existingReceiptNo: "PN-X" }))
        .mockRejectedValueOnce(new BadRequestException("Phiếu nhập đã hủy"));
      prisma.stockReceipt.findFirst.mockResolvedValueOnce(null); // PN-MISSING lookup

      const out = await service.bulkUpdateInvoices(parsed, user);

      expect(out.results.map((r) => r.status)).toEqual(["UPDATED", "DUPLICATE", "NOT_FOUND", "ERROR"]);
      expect(out.results[1]).toMatchObject({ existingReceiptId: "rx", existingReceiptNo: "PN-X" });
      expect(out.summary).toEqual({ total: 4, updated: 1, duplicate: 1, notFound: 1, error: 1 });
    });

    it("maps NotFoundException from updateInvoice to NOT_FOUND", async () => {
      const parsed = bulkReceiptInvoicesSchema.parse({ items: [{ receiptId: "zz", invoiceNumber: "9" }] }) as Parameters<
        StockReceiptsService["bulkUpdateInvoices"]
      >[0];
      jest.spyOn(service, "updateInvoice").mockRejectedValue(new NotFoundException("Không tìm thấy phiếu nhập"));

      const out = await service.bulkUpdateInvoices(parsed, user);

      expect(out.results[0].status).toBe("NOT_FOUND");
    });

    it("rejects a row that has neither receiptId nor receiptNo", () => {
      expect(bulkReceiptInvoicesSchema.safeParse([{ invoiceNumber: "1" }]).success).toBe(false);
    });
  });
});
