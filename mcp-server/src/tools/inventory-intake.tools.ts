import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDate, formatVND } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

/**
 * Invoice intake tools (docs/INVENTORY_COSTING_SPEC.md §6). Receipts created here are ALWAYS drafts:
 * nothing in this file confirms, cancels or prices stock.
 */

interface MatchedMaterial {
  id: string;
  code: string;
  name: string;
  unit: string;
  kind: string;
}

interface MatchCandidate {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  score: number;
  reasons: string[];
}

interface IntakeResult {
  skipped?: string;
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
  warnings?: string[];
  message?: string;
}

interface PendingLine {
  id: string;
  lineNo: number;
  supplierItemCode: string | null;
  supplierItemName: string;
  supplierUnit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  status: string;
  receipt?: { id: string; receiptNo: string; invoiceSeries: string | null; invoiceNumber: string | null; supplier?: { name: string } | null };
}

interface PendingReviewReceipt {
  id: string;
  receiptNo: string;
  source: string;
  receiptType: string;
  invoiceSeries: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  vatTotal: number | null;
  roundingDiff: number | null;
  itemCount: number;
  pendingLineCount: number;
  expenseLineCount: number;
  supplier?: { name: string } | null;
}

function warningsText(warnings: string[] | undefined): string {
  return warnings?.length ? `⚠️ Cảnh báo:\n${warnings.map((w) => `   - ${w}`).join("\n")}\n` : "";
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function supplierRef(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (str(args, "supplierId")) out["supplierId"] = str(args, "supplierId");
  if (str(args, "supplierTaxCode")) out["supplierTaxCode"] = str(args, "supplierTaxCode");
  return out;
}

const SUPPLIER_PROPERTIES = {
  supplierId: { type: "string", description: "ID nhà cung cấp (hoặc dùng supplierTaxCode)" },
  supplierTaxCode: { type: "string", description: "MST nhà cung cấp (hoặc dùng supplierId). Không tự tạo NCC nếu chưa có." }
};

const MUST_NOT_CONFIRM =
  "Phiếu luôn ở trạng thái NHÁP; không có tool nào ở đây xác nhận phiếu — người có quyền duyệt phải review rồi xác nhận trong CRM.";

export const inventoryIntakeTools: McpTool[] = [
  {
    name: "match_invoice_line",
    description:
      "Ghép một dòng hóa đơn của NCC với vật tư trong kho. Khớp chính xác theo alias (mã NCC trước, rồi tên đã chuẩn hóa); " +
      "nếu không khớp chỉ trả GỢI Ý (candidates) — gợi ý không bao giờ tự được chấp nhận. " +
      "Dùng khi: 'Dòng Bolt M8 của Misumi là vật tư nào?'.",
    inputSchema: {
      type: "object",
      properties: {
        ...SUPPLIER_PROPERTIES,
        itemCode: { type: "string", description: "Tuỳ chọn. Mã hàng trên hóa đơn của NCC" },
        itemName: { type: "string", description: "Tên hàng trên hóa đơn" },
        unit: { type: "string", description: "Tuỳ chọn. Đơn vị tính trên hóa đơn" }
      },
      required: ["itemName"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = { ...supplierRef(args), itemName: args["itemName"] };
      if (str(args, "itemCode")) payload["itemCode"] = str(args, "itemCode");
      if (str(args, "unit")) payload["unit"] = str(args, "unit");

      const res = await client.post<unknown>("/invoice-intake/match-line", payload);
      const data = extractData<{
        matched: MatchedMaterial | null;
        alias: { id: string; matchedBy: string; unitConversion: number | null } | null;
        confidence: number;
        candidates: MatchCandidate[];
      }>(res.data);

      if (data.matched) {
        const conv = data.alias?.unitConversion ? ` | Quy đổi: 1 đơn vị NCC = ${data.alias.unitConversion} ${data.matched.unit}` : "";
        return (
          `✅ Khớp alias (${data.alias?.matchedBy === "CODE" ? "theo mã" : "theo tên"}, độ tin cậy ${data.confidence})\n` +
          `Vật tư: **${data.matched.name}** (${data.matched.code}) | ID: \`${data.matched.id}\`${conv}`
        );
      }
      if (!data.candidates.length) return "❓ Chưa có alias và không tìm thấy vật tư gần giống. Hãy chọn vật tư rồi gọi save_material_alias.";
      const lines = data.candidates.map(
        (c, i) => `${i + 1}. ${c.name} (${c.code}) | ID: \`${c.materialId}\` | điểm ${c.score} | ${c.reasons.join(", ")}`
      );
      return (
        `❓ Chưa có alias khớp. Gợi ý (cần người xác nhận, KHÔNG tự chấp nhận):\n${lines.join("\n")}\n` +
        `💡 Sau khi chọn đúng, gọi save_material_alias để lần sau tự khớp.`
      );
    }
  },

  {
    name: "save_material_alias",
    description:
      "Lưu alias: hàng trên hóa đơn của NCC (mã và/hoặc tên) = vật tư nào, kèm hệ số quy đổi đơn vị nếu có. " +
      "Tạo mới hoặc cập nhật (không trùng). Lần sau cùng NCC gửi dòng này sẽ tự khớp.",
    inputSchema: {
      type: "object",
      properties: {
        ...SUPPLIER_PROPERTIES,
        supplierItemCode: { type: "string", description: "Tuỳ chọn. Mã hàng của NCC" },
        supplierItemName: { type: "string", description: "Tên hàng trên hóa đơn của NCC" },
        supplierUnit: { type: "string", description: "Tuỳ chọn. Đơn vị tính của NCC (bộ, thùng…)" },
        materialId: { type: "string", description: "ID vật tư nội bộ" },
        unitConversion: { type: "number", description: "Tuỳ chọn. 1 đơn vị NCC = N đơn vị vật tư (VD 1 thùng = 12 cái → 12)" }
      },
      required: ["supplierItemName", "materialId"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        ...supplierRef(args),
        supplierItemName: args["supplierItemName"],
        materialId: args["materialId"]
      };
      for (const key of ["supplierItemCode", "supplierUnit"]) if (str(args, key)) payload[key] = str(args, key);
      if (typeof args["unitConversion"] === "number") payload["unitConversion"] = args["unitConversion"];

      const res = await client.post<unknown>("/invoice-intake/aliases", payload);
      const alias = extractData<{ id: string; created: boolean; materialCode: string; normalizedName: string; unitConversion: number | null }>(res.data);
      return (
        `✅ Đã ${alias.created ? "tạo" : "cập nhật"} alias → vật tư **${alias.materialCode}**\n` +
        `ID alias: \`${alias.id}\` | Tên chuẩn hóa: ${alias.normalizedName}` +
        (alias.unitConversion ? ` | Quy đổi ×${alias.unitConversion}` : "")
      );
    }
  },

  {
    name: "list_pending_invoice_lines",
    description:
      "Danh sách dòng hóa đơn chưa ghép được vật tư (hàng đợi chờ ghép). Các dòng này CHƯA tạo tồn kho; phiếu còn dòng chờ ghép không xác nhận được. " +
      "Dùng khi: 'Còn dòng hóa đơn nào chưa ghép?'.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["PENDING", "RESOLVED", "DISCARDED"], description: "Mặc định PENDING" },
        supplierId: { type: "string", description: "Lọc theo NCC" },
        receiptId: { type: "string", description: "Lọc theo phiếu nhập" },
        projectId: { type: "string", description: "Lọc theo dự án" },
        page: { type: "number", description: "Trang, mặc định 1" },
        limit: { type: "number", description: "Số dòng mỗi trang, mặc định 20, tối đa 200" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = { page: args["page"] ?? 1, limit: args["limit"] ?? 20 };
      for (const key of ["status", "supplierId", "receiptId", "projectId"]) if (str(args, key)) params[key] = str(args, key);

      const res = await client.get<unknown>("/invoice-intake/pending-lines", { params });
      const items = extractData<PendingLine[]>(res.data);
      const meta = extractMeta(res.data);
      if (!items.length) return "📭 Không có dòng hóa đơn nào đang chờ ghép.";

      const lines = items.map((l) => {
        const inv = l.receipt ? `${l.receipt.receiptNo} (HĐ ${l.receipt.invoiceSeries ?? ""}-${l.receipt.invoiceNumber ?? ""}, ${l.receipt.supplier?.name ?? "?"})` : "";
        const price = l.unitPrice === null ? "" : ` × ${formatVND(l.unitPrice)}`;
        return (
          `${l.lineNo}. **${l.supplierItemName}**${l.supplierItemCode ? ` [${l.supplierItemCode}]` : ""} | SL ${l.quantity ?? "?"} ${l.supplierUnit ?? ""}${price}\n` +
          `   ID: \`${l.id}\` | Phiếu: ${inv} | ${l.status}`
        );
      });
      return `📋 **${meta?.total ?? items.length} dòng** (trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1})\n\n${lines.join("\n")}`;
    }
  },

  {
    name: "resolve_pending_invoice_line",
    description:
      "Ghép một dòng chờ ghép vào vật tư: tạo dòng phiếu nhập thật trên phiếu NHÁP, đánh dấu RESOLVED, mặc định lưu alias cho lần sau (saveAlias=true).",
    inputSchema: {
      type: "object",
      properties: {
        lineId: { type: "string", description: "ID dòng chờ ghép (từ list_pending_invoice_lines)" },
        materialId: { type: "string", description: "ID vật tư" },
        saveAlias: { type: "boolean", description: "Lưu alias để lần sau tự khớp. Mặc định true" },
        unitConversion: { type: "number", description: "Tuỳ chọn. 1 đơn vị NCC = N đơn vị vật tư" }
      },
      required: ["lineId", "materialId"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = { materialId: args["materialId"], saveAlias: args["saveAlias"] ?? true };
      if (typeof args["unitConversion"] === "number") payload["unitConversion"] = args["unitConversion"];
      const res = await client.post<unknown>(`/invoice-intake/pending-lines/${encodeURIComponent(String(args["lineId"]))}/resolve`, payload);
      const r = extractData<{ quantity: number; unitPrice: number; total: number; aliasSaved: boolean; remainingPendingLines: number }>(res.data);
      return (
        `✅ Đã ghép dòng: SL ${r.quantity} × ${formatVND(r.unitPrice)} = ${formatVND(r.total)}${r.aliasSaved ? " | đã lưu alias" : ""}\n` +
        `Còn ${r.remainingPendingLines} dòng chờ ghép trên phiếu này.`
      );
    }
  },

  {
    name: "discard_pending_invoice_line",
    description: "Bỏ một dòng chờ ghép (không nhập kho dòng này) kèm lý do bắt buộc. Chỉ với phiếu còn NHÁP.",
    inputSchema: {
      type: "object",
      properties: {
        lineId: { type: "string", description: "ID dòng chờ ghép" },
        reason: { type: "string", description: "Lý do bỏ dòng (≥ 3 ký tự)" }
      },
      required: ["lineId", "reason"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/invoice-intake/pending-lines/${encodeURIComponent(String(args["lineId"]))}/discard`, {
        reason: args["reason"]
      });
      const r = extractData<{ remainingPendingLines: number }>(res.data);
      return `✅ Đã bỏ dòng chờ ghép. Còn ${r.remainingPendingLines} dòng chờ ghép trên phiếu này.`;
    }
  },

  {
    name: "create_stock_receipt_from_invoice",
    description:
      "Tạo phiếu nhập kho NHÁP từ một hóa đơn mua (một lần gọi trọn gói). " +
      "Chống trùng theo (MST người bán, ký hiệu, số): gọi lại trả phiếu cũ với alreadyExists=true. " +
      "Hóa đơn BÁN RA của AHSO (MST người bán = MST công ty) bị bỏ qua (skipped=SALES_INVOICE). " +
      "Dòng GOODS khớp alias → dòng phiếu; không khớp → hàng đợi chờ ghép (không tạo tồn). " +
      "Dòng SERVICE/EXPENSE → chi phí dự án (không qua kho). Hóa đơn thay thế/điều chỉnh (invoiceType + relatedInvoiceRef) → phiếu điều chỉnh chênh lệch so với phiếu gốc. " +
      "Đơn giá là giá CHƯA VAT; VAT tách riêng. Phiếu từ EMAIL_AUTO/IMPORT luôn ở NHÁP + chờ duyệt. " +
      MUST_NOT_CONFIRM,
    inputSchema: {
      type: "object",
      properties: {
        sellerTaxCode: { type: "string", description: "MST người bán" },
        series: { type: "string", description: "Ký hiệu hóa đơn, VD C26TAA" },
        number: { type: "string", description: "Số hóa đơn, VD 0000123" },
        date: { type: "string", description: "Ngày hóa đơn (ISO date)" },
        receiptDate: { type: "string", description: "Tuỳ chọn. Ngày nhập kho; mặc định = ngày hóa đơn" },
        supplierId: { type: "string", description: "Tuỳ chọn. ID NCC; bỏ trống thì tìm theo MST người bán (không tự tạo NCC)" },
        supplierName: { type: "string", description: "Tuỳ chọn. Tên NCC trên hóa đơn (chỉ để tham khảo)" },
        warehouseId: { type: "string", description: "Tuỳ chọn. ID kho; bỏ trống thì dùng kho duy nhất đang hoạt động" },
        vatTotal: { type: "number", description: "Tuỳ chọn. Tổng tiền VAT trên hóa đơn" },
        totalDeclared: { type: "number", description: "Tuỳ chọn. Tổng thanh toán ghi trên hóa đơn (để tính chênh lệch làm tròn)" },
        fileRef: { type: "string", description: "Tuỳ chọn. Đường dẫn/tham chiếu file hóa đơn" },
        lookupCode: { type: "string", description: "Tuỳ chọn. Mã tra cứu hóa đơn điện tử" },
        notes: { type: "string", description: "Tuỳ chọn. Ghi chú" },
        source: { type: "string", enum: ["EMAIL_AUTO", "IMPORT", "MANUAL"], description: "Nguồn tạo phiếu" },
        invoiceType: { type: "string", enum: ["PURCHASE", "REPLACEMENT", "ADJUSTMENT"], description: "Mặc định PURCHASE" },
        relatedInvoiceRef: { type: "string", description: "Bắt buộc khi thay thế/điều chỉnh: 'ký hiệu-số' của hóa đơn gốc (hoặc số/ID phiếu gốc)" },
        lines: {
          type: "array",
          description: "Các dòng hóa đơn",
          items: {
            type: "object",
            properties: {
              lineNo: { type: "number", description: "Số thứ tự dòng trên hóa đơn" },
              code: { type: "string", description: "Tuỳ chọn. Mã hàng của NCC" },
              name: { type: "string", description: "Tên hàng" },
              unit: { type: "string", description: "Đơn vị tính" },
              qty: { type: "number", description: "Số lượng" },
              unitPrice: { type: "number", description: "Đơn giá CHƯA VAT (VND)" },
              vatRate: { type: "number", description: "Tuỳ chọn. Thuế suất %" },
              vatAmount: { type: "number", description: "Tuỳ chọn. Tiền VAT của dòng" },
              lineKind: { type: "string", enum: ["GOODS", "SERVICE", "EXPENSE"], description: "Mặc định GOODS" },
              materialId: { type: "string", description: "Tuỳ chọn. Vật tư đã biết (bỏ qua ghép alias)" },
              projectId: { type: "string", description: "Tuỳ chọn. Dự án liên quan" },
              costGroup: {
                type: "string",
                enum: ["MECHANICAL", "ELECTRICAL", "VISION", "SOFTWARE", "LABOR", "OUTSOURCE", "SHIPPING", "TRAVEL", "OTHER"],
                description: "Tuỳ chọn, cho dòng SERVICE/EXPENSE. Mặc định OUTSOURCE (dịch vụ) / OTHER (chi phí)"
              }
            },
            required: ["lineNo", "name", "qty", "unitPrice"]
          }
        }
      },
      required: ["sellerTaxCode", "series", "number", "date", "source", "lines"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>("/invoice-intake/receipts", args);
      const r = extractData<IntakeResult>(res.data);

      if (r.skipped) return `⏭️ Bỏ qua: ${r.message ?? "hóa đơn bán ra của AHSO"} (skipped=${r.skipped}). Không ghi gì vào hệ thống.`;
      if (r.alreadyExists) {
        return (
          `♻️ Hóa đơn đã có trong hệ thống (alreadyExists=true), không tạo thêm.\n` +
          (r.receiptNo ? `Phiếu: **${r.receiptNo}** | ID: \`${r.receiptId}\` | ${r.status} / ${r.reviewStatus ?? "—"}\n` : "") +
          (r.expenseLineIds?.length ? `Dòng chi phí: ${r.expenseLineIds.length}\n` : "")
        );
      }
      if (r.noDifference) return `ℹ️ ${r.message ?? "Không có chênh lệch"}.\n${warningsText(r.warnings)}`;

      const head = r.receiptId
        ? `✅ Đã tạo phiếu ${r.receiptType === "ADJUSTMENT" ? "ĐIỀU CHỈNH" : "nhập"} nháp **${r.receiptNo}** | ID: \`${r.receiptId}\`\n` +
          `Trạng thái: ${r.status} | Duyệt: ${r.reviewStatus ?? "không cần"}\n`
        : `✅ Hóa đơn chỉ có dòng dịch vụ/chi phí: không tạo phiếu nhập kho.\n`;
      return (
        head +
        `Dòng đã ghép: ${r.matchedLines ?? 0} | Chờ ghép: ${r.pendingLines ?? 0} | Chi phí: ${r.expenseLines ?? 0}\n` +
        `Tổng chưa VAT: ${formatVND(r.totalAmount ?? 0)} | VAT: ${formatVND(r.vatTotal ?? 0)} | Chênh lệch làm tròn: ${formatVND(r.roundingDiff ?? 0)}\n` +
        warningsText(r.warnings) +
        `💡 ${MUST_NOT_CONFIRM}`
      );
    }
  },

  {
    name: "list_pending_review_receipts",
    description:
      "Danh sách phiếu nhập từ hóa đơn tự động đang CHỜ DUYỆT (PENDING_REVIEW): số dòng chờ ghép, tổng tiền, chênh lệch làm tròn, nguồn. " +
      "Dùng khi: 'Có phiếu nào chờ duyệt không?'.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["EMAIL_AUTO", "IMPORT", "MANUAL"], description: "Lọc theo nguồn" },
        supplierId: { type: "string", description: "Lọc theo NCC" },
        page: { type: "number", description: "Trang, mặc định 1" },
        limit: { type: "number", description: "Số phiếu mỗi trang, mặc định 20" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = { page: args["page"] ?? 1, limit: args["limit"] ?? 20 };
      for (const key of ["source", "supplierId"]) if (str(args, key)) params[key] = str(args, key);
      const res = await client.get<unknown>("/invoice-intake/receipts/pending-review", { params });
      const items = extractData<PendingReviewReceipt[]>(res.data);
      const meta = extractMeta(res.data);
      if (!items.length) return "📭 Không có phiếu nhập nào chờ duyệt.";

      const lines = items.map(
        (r, i) =>
          `${i + 1}. **${r.receiptNo}** (${r.receiptType}) | ${r.supplier?.name ?? "—"} | HĐ ${r.invoiceSeries ?? ""}-${r.invoiceNumber ?? ""} ${r.invoiceDate ? formatDate(r.invoiceDate) : ""}\n` +
          `   ID: \`${r.id}\` | Nguồn: ${r.source} | Dòng: ${r.itemCount} | Chờ ghép: ${r.pendingLineCount} | Chi phí: ${r.expenseLineCount}\n` +
          `   Tổng chưa VAT: ${r.totalAmount === null ? "—" : formatVND(r.totalAmount)} | VAT: ${r.vatTotal === null ? "—" : formatVND(r.vatTotal)} | Chênh lệch: ${r.roundingDiff === null ? "—" : formatVND(r.roundingDiff)}`
      );
      return `📋 **${meta?.total ?? items.length} phiếu chờ duyệt** (trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1})\n\n${lines.join("\n")}`;
    }
  },

  {
    name: "review_stock_receipt",
    description:
      "Duyệt phiếu nhập từ hóa đơn tự động (PENDING_REVIEW → REVIEWED). Cần quyền inventory.approve; tài khoản máy (API token) KHÔNG dùng được. " +
      "Duyệt xong vẫn phải xác nhận phiếu (confirm_stock_receipt) và phiếu không được còn dòng chờ ghép.",
    inputSchema: {
      type: "object",
      properties: {
        receiptId: { type: "string", description: "ID phiếu nhập" },
        note: { type: "string", description: "Tuỳ chọn. Ghi chú duyệt (lưu vào nhật ký)" }
      },
      required: ["receiptId"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      if (str(args, "note")) payload["note"] = str(args, "note");
      const res = await client.post<unknown>(`/stock-receipts/${encodeURIComponent(String(args["receiptId"]))}/review`, payload);
      const r = extractData<{ receiptNo: string; reviewedAt: string }>(res.data);
      return `✅ Đã duyệt phiếu **${r.receiptNo}** lúc ${formatDate(r.reviewedAt)}.\n💡 Dùng confirm_stock_receipt để xác nhận nhập kho.`;
    }
  }
];
