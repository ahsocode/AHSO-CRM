import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException
} from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { JwtUser } from "../auth/auth.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../common/prisma.service";
import { assertPeriodOpen, canViewCost, getCompanyTaxCode, maskCosts } from "../inventory/inventory-controls";
import { addToAggregate, computeAdjustmentLines, type MaterialAggregate } from "./adjustment.util";
import type {
  CreateReceiptFromInvoiceDto,
  InvoiceLineDto,
  PendingReviewFilterDto
} from "./dto/invoice-intake.dto";
import {
  actorUserId,
  cleanTaxCode,
  composeInvoiceNo,
  isSameTaxCode,
  isUniqueViolation,
  parseInvoiceRef
} from "./invoice-intake.utils";
import { MaterialMatchingService, type SupplierRef } from "./material-matching.service";

type Db = PrismaClient | Prisma.TransactionClient;
type CostGroupValue = "MECHANICAL" | "ELECTRICAL" | "VISION" | "SOFTWARE" | "LABOR" | "OUTSOURCE" | "SHIPPING" | "TRAVEL" | "OTHER";

interface InvoiceKey {
  sellerTaxCode: string;
  invoiceSeries: string;
  invoiceNumber: string;
}

export interface IntakeResult {
  skipped?: "SALES_INVOICE";
  alreadyExists?: boolean;
  created?: boolean;
  noDifference?: boolean;
  receiptId?: string | null;
  receiptNo?: string | null;
  status?: string | null;
  reviewStatus?: string | null;
  receiptType?: string;
  matchedLines?: number;
  pendingLines?: number;
  expenseLines?: number;
  expenseLineIds?: string[];
  totalAmount?: number;
  vatTotal?: number | null;
  roundingDiff?: number;
  warnings: string[];
  message?: string;
}

interface StockLineData {
  lineNo: number;
  materialId: string;
  quantity: Decimal;
  unitPrice: Decimal;
  total: Decimal;
  vatRate: Decimal | null;
  vatAmount: Decimal | null;
  projectId: string | null;
}

interface PendingLineData {
  lineNo: number;
  code: string | null;
  name: string;
  unit: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
  total: Decimal;
  vatRate: Decimal | null;
  vatAmount: Decimal | null;
  projectId: string | null;
}

interface ExpenseLineData {
  lineNo: number;
  name: string;
  amount: Decimal;
  group: CostGroupValue;
  vatRate: Decimal | null;
  vatAmount: Decimal | null;
  projectId: string | null;
  note: string;
}

const AUTO_SOURCES = new Set(["EMAIL_AUTO", "IMPORT"]);
const ROUNDING_WARN_THRESHOLD = new Decimal(1000);
const ZERO = new Decimal(0);

const dec = (value: number | string) => new Decimal(String(value));
const round0 = (value: Decimal) => value.toDecimalPlaces(0);

@Injectable()
export class InvoiceIntakeService {
  private readonly logger = new Logger(InvoiceIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MaterialMatchingService,
    private readonly audit: AuditService
  ) {}

  /**
   * create_stock_receipt_from_invoice. Always DRAFT (+ PENDING_REVIEW for automatic sources),
   * idempotent on (sellerTaxCode, series, number), never touches Material.costPrice.
   */
  async createFromInvoice(dto: CreateReceiptFromInvoiceDto, user: JwtUser): Promise<IntakeResult> {
    const companyTaxCode = await getCompanyTaxCode(this.prisma);
    if (isSameTaxCode(dto.sellerTaxCode, companyTaxCode)) {
      return {
        skipped: "SALES_INVOICE",
        message: "Đây là hóa đơn bán ra của AHSO, không nhập kho.",
        warnings: []
      };
    }

    const key: InvoiceKey = {
      sellerTaxCode: cleanTaxCode(dto.sellerTaxCode),
      invoiceSeries: dto.series,
      invoiceNumber: dto.number
    };

    try {
      const result = await this.prisma.$transaction((tx) => this.createInTx(tx, dto, key, user), { timeout: 30000 });
      if (result.created) await this.recordAudit(user, result, key, dto);
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Concurrent request won the partial unique index: return its receipt.
        const existing = await this.findExisting(this.prisma, key);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async createInTx(
    tx: Prisma.TransactionClient,
    dto: CreateReceiptFromInvoiceDto,
    key: InvoiceKey,
    user: JwtUser
  ): Promise<IntakeResult> {
    // Serialise the same invoice so expense-only invoices (no unique index) are idempotent too.
    const lockKey = `invoice-intake:${key.sellerTaxCode}|${key.invoiceSeries}|${key.invoiceNumber}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await this.findExisting(tx, key);
    if (existing) return existing;

    const warnings: string[] = [];
    const supplier = await this.matching.resolveSupplier(tx, {
      supplierId: dto.supplierId,
      supplierTaxCode: key.sellerTaxCode
    });
    if (supplier.taxCode && cleanTaxCode(supplier.taxCode) !== key.sellerTaxCode) {
      warnings.push(`MST người bán (${key.sellerTaxCode}) khác MST của nhà cung cấp ${supplier.name} (${cleanTaxCode(supplier.taxCode)})`);
    }
    if (supplier.supplierType === "OTHER") {
      warnings.push(`Nhà cung cấp "${supplier.name}" thuộc loại Khác — hãy kiểm tra lại đây có phải hàng nhập kho không`);
    }

    await this.assertProjectsExist(tx, dto.lines);

    const isAdjustment = dto.invoiceType !== "PURCHASE";
    const classified = await this.classifyLines(tx, dto, supplier, warnings);

    // Totals: roundingDiff = declared - (all lines + VAT). Prices are never altered to make totals match.
    const lineSum = [
      ...classified.stock.map((l) => l.total),
      ...classified.pending.map((l) => l.total),
      ...classified.expense.map((l) => l.amount)
    ].reduce((s, v) => s.plus(v), ZERO);
    const vatFromLines = dto.lines.reduce((s, l) => s.plus(l.vatAmount !== undefined ? dec(l.vatAmount) : ZERO), ZERO);
    const vatTotal = dto.vatTotal !== undefined ? dec(dto.vatTotal) : vatFromLines;
    const declared = dto.totalDeclared !== undefined ? dec(dto.totalDeclared) : null;
    const roundingDiff = declared ? declared.minus(lineSum.plus(vatTotal)) : ZERO;
    if (roundingDiff.abs().greaterThan(ROUNDING_WARN_THRESHOLD)) {
      warnings.push(
        `Tổng hóa đơn lệch ${roundingDiff.toFixed(0)} đ so với tổng các dòng + VAT (vượt ngưỡng ${ROUNDING_WARN_THRESHOLD.toFixed(0)} đ) — hãy đối chiếu`
      );
    }
    if (dto.totalDeclared === undefined) warnings.push("Không có tổng tiền khai báo trên hóa đơn, chưa đối chiếu được chênh lệch làm tròn");

    const source = dto.source;
    const autoReview = AUTO_SOURCES.has(source);
    const invoiceDate = dto.date;
    const receiptDate = dto.receiptDate ?? invoiceDate;
    const invoiceNo = composeInvoiceNo(key.invoiceSeries, key.invoiceNumber);

    if (isAdjustment) {
      return this.createAdjustment(tx, dto, key, user, supplier, classified, {
        warnings, roundingDiff, vatTotal, declared, receiptDate, invoiceDate, invoiceNo, autoReview
      });
    }

    const hasReceiptLines = classified.stock.length > 0 || classified.pending.length > 0;
    let receiptId: string | null = null;
    let receiptNo: string | null = null;
    let totalAmount = ZERO;

    if (hasReceiptLines) {
      await assertPeriodOpen(tx, receiptDate < invoiceDate ? receiptDate : invoiceDate, "phiếu nhập");
      const warehouseId = await this.resolveWarehouse(tx, dto.warehouseId);
      totalAmount = classified.stock.reduce((s, l) => s.plus(l.total), ZERO);
      receiptNo = await this.generateNextReceiptNo(tx);
      const receipt = await tx.stockReceipt.create({
        data: {
          receiptNo,
          warehouseId,
          supplierId: supplier.id,
          date: receiptDate,
          purchaseInvoiceNo: invoiceNo,
          invoiceSeries: key.invoiceSeries,
          invoiceNumber: key.invoiceNumber,
          invoiceDate,
          sellerTaxCode: key.sellerTaxCode,
          invoiceFileRef: dto.fileRef,
          invoiceLookupCode: dto.lookupCode,
          invoiceType: "NORMAL",
          relatedInvoiceRef: dto.relatedInvoiceRef,
          receiptType: "PURCHASE",
          source,
          reviewStatus: autoReview ? "PENDING_REVIEW" : null,
          status: "DRAFT",
          notes: dto.notes,
          totalAmount,
          vatTotal: round0(vatTotal),
          invoiceTotalDeclared: declared ? round0(declared) : null,
          roundingDiff: round0(roundingDiff),
          createdById: actorUserId(user),
          items: {
            create: classified.stock.map((l) => ({
              materialId: l.materialId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              total: l.total,
              vatRate: l.vatRate,
              vatAmount: l.vatAmount,
              sourceLineNo: l.lineNo,
              projectId: l.projectId
            }))
          },
          pendingLines: {
            create: classified.pending.map((l) => ({
              lineNo: l.lineNo,
              supplierItemCode: l.code,
              supplierItemName: l.name,
              supplierUnit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate,
              vatAmount: l.vatAmount,
              projectId: l.projectId
            }))
          }
        },
        select: { id: true, receiptNo: true }
      });
      receiptId = receipt.id;
      receiptNo = receipt.receiptNo;
    }

    const expenseIds = await this.createExpenseRows(tx, classified.expense, {
      key, invoiceNo, invoiceDate, supplierId: supplier.id, receiptId, source, autoReview, userId: actorUserId(user)
    });

    if (!hasReceiptLines && classified.expense.length > 0) {
      warnings.push("Hóa đơn chỉ gồm dòng dịch vụ/chi phí: không tạo phiếu nhập kho, chỉ tạo dòng chi phí");
    }

    return {
      created: true,
      alreadyExists: false,
      receiptId,
      receiptNo,
      status: receiptId ? "DRAFT" : null,
      reviewStatus: receiptId && autoReview ? "PENDING_REVIEW" : null,
      receiptType: "PURCHASE",
      matchedLines: classified.stock.length,
      pendingLines: classified.pending.length,
      expenseLines: classified.expense.length,
      expenseLineIds: expenseIds,
      totalAmount: totalAmount.toNumber(),
      vatTotal: round0(vatTotal).toNumber(),
      roundingDiff: round0(roundingDiff).toNumber(),
      warnings
    };
  }

  /** REPLACEMENT / ADJUSTMENT: a signed delta receipt against the original; never a second purchase. */
  private async createAdjustment(
    tx: Prisma.TransactionClient,
    dto: CreateReceiptFromInvoiceDto,
    key: InvoiceKey,
    user: JwtUser,
    supplier: SupplierRef,
    classified: ClassifiedLines,
    ctx: {
      warnings: string[];
      roundingDiff: Decimal;
      vatTotal: Decimal;
      declared: Decimal | null;
      receiptDate: Date;
      invoiceDate: Date;
      invoiceNo: string;
      autoReview: boolean;
    }
  ): Promise<IntakeResult> {
    const { warnings } = ctx;
    const original = await this.findOriginalReceipt(tx, dto, key.sellerTaxCode);

    if (classified.pending.length > 0) {
      throw new UnprocessableEntityException(
        `Còn ${classified.pending.length} dòng chưa ghép được vật tư (${classified.pending.map((l) => l.name).join(", ")}). ` +
          "Hãy lưu alias (save_material_alias) rồi gửi lại hóa đơn thay thế/điều chỉnh."
      );
    }
    if (classified.expense.length > 0) {
      warnings.push(
        `${classified.expense.length} dòng dịch vụ/chi phí trong hóa đơn thay thế/điều chỉnh không được tự tạo lại — hãy chỉnh chi phí dự án thủ công`
      );
    }

    // Effective original state = original items + non-cancelled adjustments already issued against it.
    const priorAdjustments = await tx.stockReceipt.findMany({
      where: { adjustsReceiptId: original.id, status: { not: "CANCELLED" }, deletedAt: null },
      include: { items: true }
    });
    const originalAgg = new Map<string, MaterialAggregate>();
    for (const item of [...original.items, ...priorAdjustments.flatMap((r) => r.items)]) {
      addToAggregate(originalAgg, item.materialId, item.quantity, item.total);
    }
    const nextAgg = new Map<string, MaterialAggregate>();
    for (const l of classified.stock) addToAggregate(nextAgg, l.materialId, l.quantity, l.total);

    const { lines, untouchedMaterialIds } = computeAdjustmentLines(originalAgg, nextAgg, dto.invoiceType === "REPLACEMENT");
    if (untouchedMaterialIds.length > 0) {
      warnings.push(`${untouchedMaterialIds.length} vật tư của phiếu gốc không có trong hóa đơn điều chỉnh nên không bị thay đổi`);
    }

    if (lines.length === 0) {
      return {
        created: false,
        alreadyExists: false,
        noDifference: true,
        receiptId: null,
        receiptNo: null,
        matchedLines: 0,
        pendingLines: 0,
        expenseLines: 0,
        expenseLineIds: [],
        roundingDiff: round0(ctx.roundingDiff).toNumber(),
        warnings: [...warnings, `Không có chênh lệch so với phiếu gốc ${original.receiptNo}, không tạo phiếu điều chỉnh`],
        message: "Không có chênh lệch so với hóa đơn gốc"
      };
    }

    await assertPeriodOpen(tx, ctx.receiptDate < ctx.invoiceDate ? ctx.receiptDate : ctx.invoiceDate, "phiếu điều chỉnh");

    const totalAmount = lines.reduce((s, l) => s.plus(l.total), ZERO);
    const receiptNo = await this.generateNextReceiptNo(tx);
    const receipt = await tx.stockReceipt.create({
      data: {
        receiptNo,
        warehouseId: original.warehouseId,
        supplierId: supplier.id,
        date: ctx.receiptDate,
        purchaseInvoiceNo: ctx.invoiceNo,
        invoiceSeries: key.invoiceSeries,
        invoiceNumber: key.invoiceNumber,
        invoiceDate: ctx.invoiceDate,
        sellerTaxCode: key.sellerTaxCode,
        invoiceFileRef: dto.fileRef,
        invoiceLookupCode: dto.lookupCode,
        invoiceType: dto.invoiceType === "REPLACEMENT" ? "REPLACEMENT" : "ADJUSTMENT",
        relatedInvoiceRef: dto.relatedInvoiceRef,
        receiptType: "ADJUSTMENT",
        adjustsReceiptId: original.id,
        source: dto.source,
        reviewStatus: ctx.autoReview ? "PENDING_REVIEW" : null,
        status: "DRAFT",
        notes: dto.notes,
        totalAmount,
        vatTotal: round0(ctx.vatTotal),
        invoiceTotalDeclared: ctx.declared ? round0(ctx.declared) : null,
        roundingDiff: round0(ctx.roundingDiff),
        createdById: actorUserId(user),
        items: {
          create: lines.map((l) => ({
            materialId: l.materialId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
            valueAdjustment: l.valueAdjustment
          }))
        }
      },
      select: { id: true, receiptNo: true }
    });

    return {
      created: true,
      alreadyExists: false,
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      status: "DRAFT",
      reviewStatus: ctx.autoReview ? "PENDING_REVIEW" : null,
      receiptType: "ADJUSTMENT",
      matchedLines: lines.length,
      pendingLines: 0,
      expenseLines: 0,
      expenseLineIds: [],
      totalAmount: totalAmount.toNumber(),
      vatTotal: round0(ctx.vatTotal).toNumber(),
      roundingDiff: round0(ctx.roundingDiff).toNumber(),
      warnings
    };
  }

  private async findOriginalReceipt(tx: Prisma.TransactionClient, dto: CreateReceiptFromInvoiceDto, sellerTaxCode: string) {
    const ref = dto.relatedInvoiceRef;
    if (!ref) {
      throw new BadRequestException(
        "Hóa đơn thay thế/điều chỉnh cần relatedInvoiceRef (ký hiệu-số, số phiếu hoặc ID phiếu nhập gốc)"
      );
    }
    const base = { status: { not: "CANCELLED" as const }, deletedAt: null, receiptType: "PURCHASE" as const };
    const parsed = parseInvoiceRef(ref);
    const candidates: Prisma.StockReceiptWhereInput[] = [
      { id: ref },
      { receiptNo: ref },
      { purchaseInvoiceNo: ref },
      ...(parsed ? [{ sellerTaxCode, invoiceSeries: parsed.series, invoiceNumber: parsed.number }] : [])
    ];
    const original = await tx.stockReceipt.findFirst({
      where: { ...base, OR: candidates },
      include: { items: true }
    });
    if (!original) {
      throw new UnprocessableEntityException(
        `Không tìm thấy phiếu nhập của hóa đơn gốc "${ref}". Hãy nhập hóa đơn gốc trước hoặc kiểm tra lại ký hiệu-số.`
      );
    }
    if (original.status !== "CONFIRMED") {
      throw new BadRequestException(
        `Phiếu gốc ${original.receiptNo} chưa được xác nhận. Hãy sửa hoặc hủy phiếu gốc thay vì tạo phiếu điều chỉnh.`
      );
    }
    return original;
  }

  private async classifyLines(
    tx: Prisma.TransactionClient,
    dto: CreateReceiptFromInvoiceDto,
    supplier: SupplierRef,
    warnings: string[]
  ): Promise<ClassifiedLines> {
    const stock: StockLineData[] = [];
    const pending: PendingLineData[] = [];
    const expense: ExpenseLineData[] = [];
    const supplierIsExpense = supplier.supplierType === "SERVICE" || supplier.supplierType === "EXPENSE";

    for (const line of dto.lines) {
      const qty = dec(line.qty);
      const exactPrice = dec(line.unitPrice);
      const lineTotal = round0(qty.mul(exactPrice));
      const vatRate = line.vatRate !== undefined ? dec(line.vatRate) : null;
      const vatAmount = line.vatAmount !== undefined ? round0(dec(line.vatAmount)) : null;
      const projectId = line.projectId ?? null;

      let expenseKind: "SERVICE" | "EXPENSE" | null = null;
      if (line.lineKind !== "GOODS") expenseKind = line.lineKind;
      else if (supplierIsExpense) {
        expenseKind = supplier.supplierType === "SERVICE" ? "SERVICE" : "EXPENSE";
        warnings.push(`Dòng ${line.lineNo}: nhà cung cấp loại ${supplier.supplierType === "SERVICE" ? "Dịch vụ" : "Chi phí"} nên được hạch toán chi phí, không nhập kho`);
      }

      if (!expenseKind) {
        const resolved = await this.resolveMaterial(tx, supplier.id, line);
        if (resolved && resolved.kind === "SERVICE") {
          expenseKind = "SERVICE";
        } else if (resolved) {
          const conv = resolved.unitConversion;
          const quantity = conv ? qty.mul(conv).toDecimalPlaces(3) : qty;
          const unitPrice = conv ? round0(exactPrice.div(conv)) : round0(exactPrice);
          // With a unit conversion the stored total is recomputed, so rounding lands in roundingDiff.
          const total = conv ? round0(quantity.mul(unitPrice)) : lineTotal;
          stock.push({ lineNo: line.lineNo, materialId: resolved.materialId, quantity, unitPrice, total, vatRate, vatAmount, projectId });
          continue;
        } else {
          pending.push({
            lineNo: line.lineNo,
            code: line.code ?? null,
            name: line.name,
            unit: line.unit ?? null,
            quantity: qty,
            unitPrice: round0(exactPrice),
            total: lineTotal,
            vatRate,
            vatAmount,
            projectId
          });
          continue;
        }
      }

      const group: CostGroupValue = line.costGroup ?? (expenseKind === "SERVICE" ? "OUTSOURCE" : "OTHER");
      expense.push({
        lineNo: line.lineNo,
        name: line.name,
        amount: lineTotal,
        group,
        vatRate,
        vatAmount,
        projectId,
        note: `SL ${qty.toString()}${line.unit ? ` ${line.unit}` : ""} × ${exactPrice.toString()} (chưa VAT)`
      });
    }
    return { stock, pending, expense };
  }

  /** Explicit materialId (validated) or exact alias match. Fuzzy candidates are never auto-accepted. */
  private async resolveMaterial(
    tx: Prisma.TransactionClient,
    supplierId: string,
    line: InvoiceLineDto
  ): Promise<{ materialId: string; kind: string; unitConversion: Decimal | null } | null> {
    if (line.materialId) {
      const material = await tx.material.findFirst({
        where: { id: line.materialId, deletedAt: null },
        select: { id: true, kind: true }
      });
      if (!material) throw new UnprocessableEntityException(`Dòng ${line.lineNo}: không tìm thấy vật tư đã chỉ định`);
      return { materialId: material.id, kind: material.kind, unitConversion: null };
    }
    const alias = await this.matching.findAlias(tx, supplierId, line.code, line.name);
    if (!alias) return null;
    const material = await tx.material.findFirst({
      where: { id: alias.materialId, deletedAt: null },
      select: { id: true, kind: true }
    });
    if (!material) return null;
    return { materialId: material.id, kind: material.kind, unitConversion: alias.unitConversion };
  }

  private async createExpenseRows(
    tx: Prisma.TransactionClient,
    rows: ExpenseLineData[],
    ctx: {
      key: InvoiceKey;
      invoiceNo: string;
      invoiceDate: Date;
      supplierId: string;
      receiptId: string | null;
      source: "EMAIL_AUTO" | "IMPORT" | "MANUAL";
      autoReview: boolean;
      userId: string;
    }
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const row of rows) {
      const created = await tx.projectCost.create({
        data: {
          projectId: row.projectId,
          group: row.group,
          description: row.name,
          supplierId: ctx.supplierId,
          invoiceNo: ctx.invoiceNo,
          invoiceDate: ctx.invoiceDate,
          amount: row.amount,
          vatRate: row.vatRate,
          vatAmount: row.vatAmount,
          sellerTaxCode: ctx.key.sellerTaxCode,
          invoiceSeries: ctx.key.invoiceSeries,
          invoiceNumber: ctx.key.invoiceNumber,
          lineNo: row.lineNo,
          source: ctx.source,
          reviewStatus: ctx.autoReview ? "PENDING_REVIEW" : null,
          receiptId: ctx.receiptId,
          notes: row.note,
          createdById: ctx.userId
        },
        select: { id: true }
      });
      ids.push(created.id);
    }
    return ids;
  }

  private async assertProjectsExist(tx: Prisma.TransactionClient, lines: InvoiceLineDto[]) {
    const ids = [...new Set(lines.map((l) => l.projectId).filter((v): v is string => Boolean(v)))];
    if (ids.length === 0) return;
    const found = await tx.project.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
    if (found.length !== ids.length) throw new UnprocessableEntityException("Có dự án trong dòng hóa đơn không tồn tại");
  }

  private async resolveWarehouse(tx: Prisma.TransactionClient, warehouseId?: string): Promise<string> {
    if (warehouseId) {
      const wh = await tx.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null }, select: { id: true } });
      if (!wh) throw new UnprocessableEntityException("Không tìm thấy kho");
      return wh.id;
    }
    const active = await tx.warehouse.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true }, take: 2 });
    if (active.length === 1) return active[0].id;
    throw new BadRequestException(
      active.length === 0 ? "Chưa có kho nào đang hoạt động" : "Có nhiều kho đang hoạt động, hãy truyền warehouseId"
    );
  }

  private async findExisting(db: Db, key: InvoiceKey): Promise<IntakeResult | null> {
    const receipt = await db.stockReceipt.findFirst({
      where: { ...key, status: { not: "CANCELLED" }, deletedAt: null },
      select: { id: true, receiptNo: true, status: true, reviewStatus: true, receiptType: true }
    });
    const costs = await db.projectCost.findMany({ where: { ...key, deletedAt: null }, select: { id: true } });
    if (!receipt && costs.length === 0) return null;
    return {
      alreadyExists: true,
      created: false,
      receiptId: receipt?.id ?? null,
      receiptNo: receipt?.receiptNo ?? null,
      status: receipt?.status ?? null,
      reviewStatus: receipt?.reviewStatus ?? null,
      receiptType: receipt?.receiptType,
      expenseLineIds: costs.map((c) => c.id),
      warnings: []
    };
  }

  /** Same numbering as stock-receipts (shared advisory lock, PN-YYYY-NNN). */
  private async generateNextReceiptNo(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stock_receipt_number'))`;
    const prefix = `PN-${new Date().getFullYear()}-`;
    const latest = await tx.stockReceipt.findFirst({
      where: { receiptNo: { startsWith: prefix } },
      orderBy: { receiptNo: "desc" },
      select: { receiptNo: true }
    });
    const seq = latest?.receiptNo.split("-").at(-1);
    const next = seq ? Number.parseInt(seq, 10) + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
  }

  /** list_pending_review_receipts */
  async listPendingReview(filters: PendingReviewFilterDto, user: JwtUser) {
    const where: Prisma.StockReceiptWhereInput = {
      reviewStatus: "PENDING_REVIEW",
      status: { not: "CANCELLED" },
      deletedAt: null,
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {})
    };
    const skip = (filters.page - 1) * filters.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockReceipt.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: "asc" },
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true } },
          _count: { select: { items: true, expenseCosts: true } },
          pendingLines: { where: { status: "PENDING" }, select: { id: true } }
        }
      }),
      this.prisma.stockReceipt.count({ where })
    ]);
    const items = rows.map(({ pendingLines, _count, ...r }) => ({
      ...r,
      totalAmount: Number(r.totalAmount),
      vatTotal: r.vatTotal === null ? null : Number(r.vatTotal),
      invoiceTotalDeclared: r.invoiceTotalDeclared === null ? null : Number(r.invoiceTotalDeclared),
      roundingDiff: Number(r.roundingDiff),
      itemCount: _count.items,
      expenseLineCount: _count.expenseCosts,
      pendingLineCount: pendingLines.length
    }));
    return {
      data: maskCosts(items, canViewCost(user)),
      meta: { total, page: filters.page, limit: filters.limit, totalPages: Math.max(1, Math.ceil(total / filters.limit)) }
    };
  }

  private async recordAudit(user: JwtUser, result: IntakeResult, key: InvoiceKey, dto: CreateReceiptFromInvoiceDto) {
    try {
      await this.audit.record({
        userId: user.sub,
        action: "invoice_intake.create",
        resource: result.receiptId ? "stock-receipts" : "project-costs",
        resourceId: result.receiptId ?? result.expenseLineIds?.[0] ?? null,
        changes: {
          invoice: key,
          source: dto.source,
          invoiceType: dto.invoiceType,
          receiptNo: result.receiptNo,
          matchedLines: result.matchedLines,
          pendingLines: result.pendingLines,
          expenseLines: result.expenseLines,
          roundingDiff: result.roundingDiff,
          meta: { actorType: String(user.sub).startsWith("service:") ? "SERVICE" : "USER" }
        }
      });
    } catch (error) {
      this.logger.warn(`Không ghi được audit invoice_intake.create: ${(error as Error).message}`);
    }
  }
}

interface ClassifiedLines {
  stock: StockLineData[];
  pending: PendingLineData[];
  expense: ExpenseLineData[];
}
