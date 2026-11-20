import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { InventoryBalanceService } from "../inventory/inventory-balance.service";
import { CreateStockReceiptDto } from "./dto/create-stock-receipt.dto";
import type {
  BulkReceiptInvoiceRow,
  BulkReceiptInvoicesDto,
  UpdateReceiptInvoiceDto,
} from "./dto/invoice-fields.dto";
import { StockReceiptFilterDto } from "./dto/stock-receipt-filter.dto";
import { UpdateStockReceiptDto } from "./dto/update-stock-receipt.dto";

type InvoiceKey = {
  sellerTaxCode?: string | null;
  invoiceSeries?: string | null;
  invoiceNumber?: string | null;
};

export type BulkInvoiceRowResult = {
  index: number;
  receiptId: string | null;
  receiptNo: string | null;
  status: "UPDATED" | "DUPLICATE" | "NOT_FOUND" | "ERROR";
  message: string;
  existingReceiptId?: string;
  existingReceiptNo?: string;
};

const SUPPLIER_TYPE_LABEL: Record<string, string> = {
  GOODS: "Hàng hóa",
  SERVICE: "Dịch vụ",
  EXPENSE: "Chi phí",
  OTHER: "Khác",
};

@Injectable()
export class StockReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryBalance: InventoryBalanceService
  ) {}

  async findAll(filters: StockReceiptFilterDto, _user: JwtUser) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          supplier: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.stockReceipt.count({ where }),
    ]);

    return {
      items: items.map((r) => ({
        ...r,
        totalAmount: Number(r.totalAmount),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, _user: JwtUser) {
    const receipt = await this.prisma.stockReceipt.findFirst({
      where: { id, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        supplier: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, code: true, unit: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập");

    return {
      ...receipt,
      totalAmount: Number(receipt.totalAmount),
      items: receipt.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    };
  }

  async create(dto: CreateStockReceiptDto, user: JwtUser) {
    let invoiceKey: InvoiceKey = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const warnings = await this.validateReceiptInput(tx, dto);
        const invoice = this.buildInvoiceData(dto, warnings.supplierTaxCode);
        invoiceKey = invoice;
        await this.assertInvoiceNotDuplicate(tx, invoice);

        const receiptNo = await this.generateNextReceiptNo(tx);
        const totalAmount = this.calculateTotalAmount(dto.items);

        const receipt = await tx.stockReceipt.create({
          data: {
            receiptNo,
            warehouseId: dto.warehouseId,
            supplierId: dto.supplierId,
            date: dto.date,
            purchaseInvoiceNo: invoice.purchaseInvoiceNo,
            invoiceSeries: invoice.invoiceSeries,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            sellerTaxCode: invoice.sellerTaxCode,
            invoiceFileRef: invoice.invoiceFileRef,
            invoiceLookupCode: invoice.invoiceLookupCode,
            invoiceType: invoice.invoiceType,
            relatedInvoiceRef: invoice.relatedInvoiceRef,
            notes: dto.notes,
            totalAmount,
            createdById: user.sub,
            items: {
              create: dto.items.map((item) => this.toItemCreateData(item)),
            },
          },
          select: { id: true, receiptNo: true },
        });

        return warnings.messages.length > 0 ? { ...receipt, warnings: warnings.messages } : receipt;
      });
    } catch (error) {
      throw await this.translateInvoiceUniqueError(error, invoiceKey);
    }
  }

  async update(id: string, dto: UpdateStockReceiptDto, _user: JwtUser) {
    let invoiceKey: InvoiceKey = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.stockReceipt.findFirst({
          where: { id, status: "DRAFT", deletedAt: null },
        });
        if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

        const warnings = await this.validateReceiptInput(tx, dto);
        const invoice = this.buildInvoiceData(dto, warnings.supplierTaxCode);
        // Merge with what is stored so a payload that omits the invoice keys does not lose the duplicate check.
        invoiceKey = {
          sellerTaxCode: invoice.sellerTaxCode ?? receipt.sellerTaxCode,
          invoiceSeries: invoice.invoiceSeries ?? receipt.invoiceSeries,
          invoiceNumber: invoice.invoiceNumber ?? receipt.invoiceNumber,
        };
        await this.assertInvoiceNotDuplicate(tx, invoiceKey, id);

        const totalAmount = this.calculateTotalAmount(dto.items);

        const updated = await tx.stockReceipt.update({
          where: { id },
          data: {
            warehouseId: dto.warehouseId,
            supplierId: dto.supplierId,
            date: dto.date,
            purchaseInvoiceNo: invoice.purchaseInvoiceNo,
            invoiceSeries: invoice.invoiceSeries,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            sellerTaxCode: invoice.sellerTaxCode,
            invoiceFileRef: invoice.invoiceFileRef,
            invoiceLookupCode: invoice.invoiceLookupCode,
            invoiceType: invoice.invoiceType,
            relatedInvoiceRef: invoice.relatedInvoiceRef,
            notes: dto.notes,
            totalAmount,
            items: {
              deleteMany: {},
              create: dto.items.map((item) => this.toItemCreateData(item)),
            },
          },
          select: { id: true, receiptNo: true },
        });

        return warnings.messages.length > 0 ? { ...updated, warnings: warnings.messages } : updated;
      });
    } catch (error) {
      throw await this.translateInvoiceUniqueError(error, invoiceKey);
    }
  }

  async confirm(id: string, _user: JwtUser) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.findFirst({
        where: { id, status: "DRAFT", deletedAt: null },
        include: { items: true, supplier: { select: { name: true, supplierType: true } } },
      });
      if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

      // Supplier type may have been changed after the draft was created.
      const warnings: string[] = [];
      if (receipt.supplier) {
        const message = this.checkSupplierType(receipt.supplier.supplierType, receipt.supplier.name);
        if (message) warnings.push(message);
      }

      for (const item of receipt.items) {
        const qty = new Decimal(item.quantity);
        const price = new Decimal(item.unitPrice);
        await this.inventoryBalance.adjustBalance(tx, receipt.warehouseId, item.materialId, qty);
        await this.inventoryBalance.updateAverageCostPrice(tx, item.materialId, qty, price);
        await tx.stockLot.create({
          data: {
            stockReceiptItemId: item.id,
            warehouseId: receipt.warehouseId,
            materialId: item.materialId,
            // Structured invoice date wins; otherwise the receipt date is the purchase invoice date.
            purchaseInvoiceDate: receipt.invoiceDate ?? receipt.date,
            purchaseInvoiceNo: receipt.purchaseInvoiceNo,
            receivedQuantity: qty,
            remainingQuantity: qty,
            unitPrice: price,
            projectId: item.projectId ?? undefined
          }
        });
      }

      const confirmed = await tx.stockReceipt.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        select: { id: true, receiptNo: true, status: true, confirmedAt: true },
      });
      return warnings.length > 0 ? { ...confirmed, warnings } : confirmed;
    });
  }

  /**
   * Edit ONLY the invoice information of a receipt (any status except CANCELLED).
   * Never touches items, quantities or prices. Used to back-fill invoices on old receipts.
   */
  async updateInvoice(id: string, dto: UpdateReceiptInvoiceDto, _user: JwtUser) {
    let invoiceKey: InvoiceKey = dto;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.stockReceipt.findFirst({
          where: { id, deletedAt: null },
          include: { supplier: { select: { taxCode: true } } },
        });
        if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập");
        if (receipt.status === "CANCELLED") {
          throw new BadRequestException("Phiếu nhập đã hủy, không thể sửa thông tin hóa đơn");
        }

        const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);
        const merged = {
          invoiceSeries: pick(dto.invoiceSeries, receipt.invoiceSeries),
          invoiceNumber: pick(dto.invoiceNumber, receipt.invoiceNumber),
          invoiceDate: pick(dto.invoiceDate, receipt.invoiceDate),
          sellerTaxCode: pick(dto.sellerTaxCode, receipt.sellerTaxCode),
          invoiceFileRef: pick(dto.invoiceFileRef, receipt.invoiceFileRef),
          invoiceLookupCode: pick(dto.invoiceLookupCode, receipt.invoiceLookupCode),
          invoiceType: pick(dto.invoiceType, receipt.invoiceType),
          relatedInvoiceRef: pick(dto.relatedInvoiceRef, receipt.relatedInvoiceRef),
        };
        // Fall back to the supplier's tax code when the caller did not state the seller.
        if (!merged.sellerTaxCode && dto.sellerTaxCode === undefined && receipt.supplier?.taxCode) {
          merged.sellerTaxCode = receipt.supplier.taxCode.replace(/\s+/g, "");
        }

        invoiceKey = merged;
        await this.assertInvoiceNotDuplicate(tx, merged, id);

        let purchaseInvoiceNo = receipt.purchaseInvoiceNo;
        if (!purchaseInvoiceNo && merged.invoiceNumber) {
          purchaseInvoiceNo = this.composeInvoiceNo(merged.invoiceSeries, merged.invoiceNumber);
        }

        // Lot purchase-invoice date follows the invoice date (falls back to the receipt date).
        const oldLotDate = receipt.invoiceDate ?? receipt.date;
        const newLotDate = merged.invoiceDate ?? receipt.date;
        let lotsUpdated = 0;
        if (receipt.status === "CONFIRMED") {
          const lots = await tx.stockLot.findMany({
            where: { stockReceiptItem: { receiptId: id } },
            select: { id: true, receivedQuantity: true, remainingQuantity: true },
          });
          if (oldLotDate.getTime() !== newLotDate.getTime()) {
            const consumed = lots.filter((lot) => new Decimal(lot.remainingQuantity).lessThan(lot.receivedQuantity));
            if (consumed.length > 0) {
              throw new BadRequestException(
                `Không thể đổi ngày hóa đơn: ${consumed.length} lô nhập của phiếu này đã được xuất/chuyển một phần. ` +
                  "Chỉ đổi được khi các lô chưa bị tiêu hao."
              );
            }
          }
          if (lots.length > 0) {
            const result = await tx.stockLot.updateMany({
              where: { id: { in: lots.map((lot) => lot.id) } },
              data: { purchaseInvoiceDate: newLotDate, purchaseInvoiceNo },
            });
            lotsUpdated = result.count;
          }
        }

        const updated = await tx.stockReceipt.update({
          where: { id },
          data: { ...merged, purchaseInvoiceNo },
          select: {
            id: true,
            receiptNo: true,
            status: true,
            invoiceSeries: true,
            invoiceNumber: true,
            invoiceDate: true,
            sellerTaxCode: true,
            invoiceFileRef: true,
            invoiceLookupCode: true,
            invoiceType: true,
            relatedInvoiceRef: true,
            purchaseInvoiceNo: true,
          },
        });
        return { ...updated, lotsUpdated };
      });
    } catch (error) {
      throw await this.translateInvoiceUniqueError(error, invoiceKey);
    }
  }

  /** Per-row result; one bad row never aborts the batch. */
  async bulkUpdateInvoices(dto: BulkReceiptInvoicesDto, user: JwtUser) {
    const results: BulkInvoiceRowResult[] = [];
    for (const [index, row] of dto.items.entries()) {
      results.push(await this.applyBulkRow(index, row, user));
    }
    const count = (status: BulkInvoiceRowResult["status"]) => results.filter((r) => r.status === status).length;
    return {
      results,
      summary: {
        total: results.length,
        updated: count("UPDATED"),
        duplicate: count("DUPLICATE"),
        notFound: count("NOT_FOUND"),
        error: count("ERROR"),
      },
    };
  }

  private async applyBulkRow(index: number, row: BulkReceiptInvoiceRow, user: JwtUser): Promise<BulkInvoiceRowResult> {
    const { receiptId, receiptNo, ...invoice } = row;
    try {
      let id = receiptId ?? null;
      if (!id && receiptNo) {
        const found = await this.prisma.stockReceipt.findFirst({
          where: { receiptNo, deletedAt: null },
          select: { id: true },
        });
        id = found?.id ?? null;
      }
      if (!id) {
        return { index, receiptId: receiptId ?? null, receiptNo: receiptNo ?? null, status: "NOT_FOUND", message: "Không tìm thấy phiếu nhập" };
      }
      const updated = await this.updateInvoice(id, invoice, user);
      return { index, receiptId: updated.id, receiptNo: updated.receiptNo, status: "UPDATED", message: "Đã cập nhật hóa đơn" };
    } catch (error) {
      const base = { index, receiptId: receiptId ?? null, receiptNo: receiptNo ?? null };
      if (error instanceof ConflictException) {
        const body = error.getResponse() as { message?: string; existingReceiptId?: string; existingReceiptNo?: string };
        return {
          ...base,
          status: "DUPLICATE",
          message: body.message ?? "Hóa đơn đã tồn tại",
          existingReceiptId: body.existingReceiptId,
          existingReceiptNo: body.existingReceiptNo,
        };
      }
      if (error instanceof NotFoundException) {
        return { ...base, status: "NOT_FOUND", message: error.message };
      }
      if (error instanceof HttpException) {
        return { ...base, status: "ERROR", message: error.message };
      }
      return { ...base, status: "ERROR", message: "Đã xảy ra lỗi không mong muốn" };
    }
  }

  async cancel(id: string, _user: JwtUser) {
    const receipt = await this.prisma.stockReceipt.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

    return this.prisma.stockReceipt.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { id: true, receiptNo: true, status: true },
    });
  }

  async remove(id: string, _user: JwtUser) {
    const receipt = await this.prisma.stockReceipt.findFirst({
      where: { id, status: "DRAFT", deletedAt: null },
    });
    if (!receipt) throw new NotFoundException("Không tìm thấy phiếu nhập hoặc phiếu không ở trạng thái nháp");

    await this.prisma.stockReceipt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, id };
  }

  private buildWhere(filters: StockReceiptFilterDto): Prisma.StockReceiptWhereInput {
    const where: Prisma.StockReceiptWhereInput = { deletedAt: null };

    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = filters.dateFrom;
      if (filters.dateTo) where.date.lte = filters.dateTo;
    }
    if (filters.invoiceNumber) where.invoiceNumber = { contains: filters.invoiceNumber, mode: "insensitive" };
    if (filters.invoiceSeries) where.invoiceSeries = { equals: filters.invoiceSeries, mode: "insensitive" };
    if (filters.sellerTaxCode) where.sellerTaxCode = filters.sellerTaxCode;
    if (filters.invoiceDateFrom || filters.invoiceDateTo) {
      where.invoiceDate = {};
      if (filters.invoiceDateFrom) where.invoiceDate.gte = filters.invoiceDateFrom;
      if (filters.invoiceDateTo) where.invoiceDate.lte = filters.invoiceDateTo;
    }
    if (filters.hasInvoice === true) where.invoiceNumber = where.invoiceNumber ?? { not: null };
    if (filters.hasInvoice === false) where.invoiceNumber = null;

    return where;
  }

  private composeInvoiceNo(series: string | null | undefined, number: string) {
    return series ? `${series}-${number}` : number;
  }

  private toItemCreateData(item: CreateStockReceiptDto["items"][number]) {
    return {
      materialId: item.materialId,
      quantity: new Decimal(item.quantity),
      unitPrice: new Decimal(item.unitPrice),
      total: this.calculateLineTotal(item.quantity, item.unitPrice),
      projectId: item.projectId,
    };
  }

  /**
   * Supplier type gate: SERVICE / EXPENSE suppliers are not goods, so they cannot receive stock
   * (400). OTHER is allowed with a warning. Returns the warning text, or null when fine.
   */
  private checkSupplierType(type: string, name: string): string | null {
    if (type === "SERVICE" || type === "EXPENSE") {
      throw new BadRequestException(
        `Nhà cung cấp loại ${SUPPLIER_TYPE_LABEL[type]} (${name}) không phải hàng hóa, không nhập kho`
      );
    }
    if (type === "OTHER") {
      return `Nhà cung cấp "${name}" thuộc loại Khác — hãy kiểm tra lại đây có phải hàng hóa nhập kho không`;
    }
    return null;
  }

  /** Validates supplier type and project ids of a receipt payload. */
  private async validateReceiptInput(
    tx: Prisma.TransactionClient,
    dto: CreateStockReceiptDto
  ): Promise<{ messages: string[]; supplierTaxCode: string | null }> {
    const messages: string[] = [];
    let supplierTaxCode: string | null = null;

    if (dto.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, deletedAt: null },
        select: { name: true, supplierType: true, taxCode: true },
      });
      if (!supplier) throw new BadRequestException("Không tìm thấy nhà cung cấp");
      const message = this.checkSupplierType(supplier.supplierType, supplier.name);
      if (message) messages.push(message);
      supplierTaxCode = supplier.taxCode ? supplier.taxCode.replace(/\s+/g, "") : null;
    }

    const projectIds = [...new Set(dto.items.map((item) => item.projectId).filter((v): v is string => Boolean(v)))];
    if (projectIds.length > 0) {
      const found = await tx.project.findMany({
        where: { id: { in: projectIds }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== projectIds.length) {
        throw new BadRequestException("Có dự án trong dòng hàng không tồn tại");
      }
    }

    return { messages, supplierTaxCode };
  }

  /** Normalises the invoice part of a payload and keeps the legacy purchaseInvoiceNo in sync. */
  private buildInvoiceData(dto: CreateStockReceiptDto, supplierTaxCode: string | null) {
    const sellerTaxCode = dto.sellerTaxCode ?? (dto.invoiceNumber ? supplierTaxCode ?? undefined : undefined);
    const purchaseInvoiceNo =
      dto.purchaseInvoiceNo ?? (dto.invoiceNumber ? this.composeInvoiceNo(dto.invoiceSeries, dto.invoiceNumber) : undefined);
    return {
      purchaseInvoiceNo,
      invoiceSeries: dto.invoiceSeries,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: dto.invoiceDate,
      sellerTaxCode,
      invoiceFileRef: dto.invoiceFileRef,
      invoiceLookupCode: dto.invoiceLookupCode,
      invoiceType: dto.invoiceType,
      relatedInvoiceRef: dto.relatedInvoiceRef,
    };
  }

  private hasFullInvoiceKey(key: InvoiceKey): key is Required<{ [K in keyof InvoiceKey]: string }> {
    return Boolean(key.sellerTaxCode && key.invoiceSeries && key.invoiceNumber);
  }

  private duplicateConflict(existing: { id: string; receiptNo: string }, key: InvoiceKey) {
    return new ConflictException({
      message: `Hóa đơn ${key.invoiceSeries}-${key.invoiceNumber} (MST ${key.sellerTaxCode}) đã được nhập ở phiếu ${existing.receiptNo}`,
      existingReceiptId: existing.id,
      existingReceiptNo: existing.receiptNo,
    });
  }

  /** Pre-check for the partial unique index so the caller gets a readable 409. */
  private async assertInvoiceNotDuplicate(tx: Prisma.TransactionClient, key: InvoiceKey, excludeId?: string) {
    if (!this.hasFullInvoiceKey(key)) return;
    const existing = await tx.stockReceipt.findFirst({
      where: {
        sellerTaxCode: key.sellerTaxCode,
        invoiceSeries: key.invoiceSeries,
        invoiceNumber: key.invoiceNumber,
        status: { not: "CANCELLED" },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, receiptNo: true },
    });
    if (existing) throw this.duplicateConflict(existing, key);
  }

  /**
   * Race safety: two concurrent requests can both pass the pre-check; the DB partial unique index
   * then rejects one with P2002. Map it to the same 409 shape (lookup runs outside the failed tx).
   */
  private async translateInvoiceUniqueError(error: unknown, input: InvoiceKey): Promise<unknown> {
    const e = error as { code?: string; meta?: { target?: unknown } } | null;
    if (!e || e.code !== "P2002" || !/invoice/i.test(String(e.meta?.target ?? ""))) return error;

    const key: InvoiceKey = {
      sellerTaxCode: input.sellerTaxCode,
      invoiceSeries: input.invoiceSeries,
      invoiceNumber: input.invoiceNumber,
    };
    const existing = await this.prisma.stockReceipt.findFirst({
      where: {
        ...(key.sellerTaxCode ? { sellerTaxCode: key.sellerTaxCode } : {}),
        ...(key.invoiceSeries ? { invoiceSeries: key.invoiceSeries } : {}),
        ...(key.invoiceNumber ? { invoiceNumber: key.invoiceNumber } : {}),
        status: { not: "CANCELLED" },
        deletedAt: null,
      },
      select: { id: true, receiptNo: true },
    });
    if (!existing) return error;
    return this.duplicateConflict(existing, key);
  }

  private async generateNextReceiptNo(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stock_receipt_number'))`;
    const year = new Date().getFullYear();
    const prefix = `PN-${year}-`;
    const latest = await tx.stockReceipt.findFirst({
      where: { receiptNo: { startsWith: prefix } },
      orderBy: { receiptNo: "desc" },
      select: { receiptNo: true },
    });
    const seq = latest?.receiptNo.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  private calculateLineTotal(quantity: number, unitPrice: number) {
    return new Decimal(quantity).mul(unitPrice).toDecimalPlaces(0);
  }

  private calculateTotalAmount(items: Array<{ quantity: number; unitPrice: number }>) {
    return items.reduce(
      (sum, item) => sum.plus(this.calculateLineTotal(item.quantity, item.unitPrice)),
      new Decimal(0)
    );
  }
}
