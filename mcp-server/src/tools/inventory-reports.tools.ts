import { getApiClient } from "../auth/api-client.js";
import type { McpTool } from "./index.js";
import { inventoryTools } from "./inventory.tools.js";

/**
 * Read-only inventory report tools (docs/INVENTORY_COSTING_SPEC.md §8). Each tool returns the backend
 * contract as JSON text: { meta, data, page } so scripts can parse it without scraping Markdown.
 * meta = { generatedAt, asOfDate | period, costMethod, periodLockedUntil, costVisible, filters, schemaVersion }.
 */

const PAGINATION_PROPERTIES = {
  page: { type: "number", description: "Tuỳ chọn. Trang (bắt đầu từ 1), mặc định 1" },
  limit: { type: "number", description: "Tuỳ chọn. Số dòng mỗi trang, mặc định 100, tối đa 500" }
};

const PAGINATION_KEYS = ["page", "limit"];

/** Copies only the listed argument keys that are actually set, so the backend defaults stay in force. */
function pickParams(args: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const key of keys) {
    const value = args[key];
    if (value !== undefined && value !== null && value !== "") params[key] = value;
  }
  return params;
}

async function fetchReport(path: string, args: Record<string, unknown>, keys: string[]): Promise<string> {
  const client = getApiClient();
  const res = await client.get<unknown>(`/inventory/reports/${path}`, { params: pickParams(args, [...keys, ...PAGINATION_KEYS]) });
  // The contract is returned as-is (not unwrapped) so meta/page stay visible to the caller.
  return JSON.stringify(res.data);
}

const READ_ONLY_NOTE = "Chỉ đọc, trả JSON {meta, data, page}; giá/giá trị là null nếu không có quyền xem giá.";

export const inventoryReportTools: McpTool[] = [
  {
    name: "get_stock_ledger",
    description:
      "Thẻ kho: các dòng nhập/xuất/chuyển/kiểm kê đã xác nhận theo từng vật tư và kho trong kỳ, kèm tồn đầu/cuối kỳ (meta.accounts), " +
      "số chứng từ, hóa đơn nguồn (MST người bán, ký hiệu, số, ngày, NCC) và sourceReceiptLotId cho dòng xuất. Phiếu xuất đã hủy hiện hai dòng (xuất + đảo). " +
      READ_ONLY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Bắt buộc. Từ ngày (YYYY-MM-DD)" },
        toDate: { type: "string", description: "Bắt buộc. Đến ngày (YYYY-MM-DD)" },
        materialId: { type: "string", description: "Tuỳ chọn. ID vật tư" },
        warehouseId: { type: "string", description: "Tuỳ chọn. ID kho" },
        ...PAGINATION_PROPERTIES
      },
      required: ["fromDate", "toDate"]
    },
    handler: (args) => fetchReport("stock-ledger", args, ["fromDate", "toDate", "materialId", "warehouseId"])
  },

  {
    name: "get_inventory_valuation",
    description:
      "Giá trị tồn kho tại một ngày. Hôm nay: SL × Material.costPrice (tổng bằng get_inventory_summary). Ngày quá khứ: dựng lại từ các chứng từ đã xác nhận " +
      "(bình quân gia quyền di động, ghi trong meta.valuationMethod; meta.reconciliationDiff cho biết độ lệch với giá hiện tại). " +
      "Có thể nhóm theo nhóm hạch toán (TK152/153/155/156) hoặc kho. " + READ_ONLY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        asOfDate: { type: "string", description: "Tuỳ chọn. Ngày tính (YYYY-MM-DD), mặc định hôm nay" },
        groupBy: { type: "string", enum: ["none", "accountingClass", "warehouse"], description: "Tuỳ chọn. Nhóm kết quả, mặc định none (từng vật tư/kho)" },
        accountingClass: {
          type: "string",
          enum: ["RAW_MATERIAL", "TOOL", "MERCHANDISE", "FINISHED_GOOD", "CONSUMABLE_COMMON", "UNCLASSIFIED"],
          description: "Tuỳ chọn. Lọc theo nhóm hạch toán (UNCLASSIFIED = chưa phân loại)"
        },
        warehouseId: { type: "string", description: "Tuỳ chọn. ID kho" },
        materialId: { type: "string", description: "Tuỳ chọn. ID vật tư" },
        ...PAGINATION_PROPERTIES
      },
      required: []
    },
    handler: (args) =>
      fetchReport("inventory-valuation", args, ["asOfDate", "groupBy", "accountingClass", "warehouseId", "materialId"])
  },

  {
    name: "get_project_cost",
    description:
      "Giá vốn dự án: vật tư = phiếu xuất đã xác nhận (không tính phiếu hủy) theo giá xuất đã ghi, trừ phiếu hoàn kho; cộng chi phí trực tiếp (ProjectCost) theo nhóm CostGroup; " +
      "có số hóa đơn nguồn của từng dòng xuất. Không truyền projectId thì liệt kê các dự án có phát sinh (phân trang, mặc định không kèm dòng chi tiết). " + READ_ONLY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Tuỳ chọn. ID dự án" },
        fromDate: { type: "string", description: "Tuỳ chọn. Từ ngày (YYYY-MM-DD)" },
        toDate: { type: "string", description: "Tuỳ chọn. Đến ngày (YYYY-MM-DD)" },
        includeLines: { type: "boolean", description: "Tuỳ chọn. Kèm dòng chi tiết (mặc định true khi có projectId)" },
        ...PAGINATION_PROPERTIES
      },
      required: []
    },
    handler: (args) => fetchReport("project-cost", args, ["projectId", "fromDate", "toDate", "includeLines"])
  },

  {
    name: "list_unallocated_receipts",
    description:
      "Dòng phiếu nhập mua đã xác nhận, chưa gắn dự án và lô còn tồn — cần phân bổ. Mặc định bỏ vật tư phụ dùng chung (CONSUMABLE_COMMON). " + READ_ONLY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Tuỳ chọn. Từ ngày phiếu (YYYY-MM-DD)" },
        toDate: { type: "string", description: "Tuỳ chọn. Đến ngày phiếu (YYYY-MM-DD)" },
        warehouseId: { type: "string", description: "Tuỳ chọn. ID kho" },
        supplierId: { type: "string", description: "Tuỳ chọn. ID nhà cung cấp" },
        materialId: { type: "string", description: "Tuỳ chọn. ID vật tư" },
        includeCommon: { type: "boolean", description: "Tuỳ chọn. Gồm cả vật tư phụ dùng chung, mặc định false" },
        ...PAGINATION_PROPERTIES
      },
      required: []
    },
    handler: (args) =>
      fetchReport("unallocated-receipts", args, ["fromDate", "toDate", "warehouseId", "supplierId", "materialId", "includeCommon"])
  },

  {
    name: "get_receipts_without_invoice",
    description:
      "Phiếu nhập mua đã xác nhận còn thiếu hóa đơn — cổng kiểm tra trước khi bắt đầu xuất kho (62 phiếu cũ cần bổ sung). " +
      "mode=NUMBER (mặc định): thiếu số hóa đơn; ANY_FIELD: thiếu số, ký hiệu, ngày hoặc MST người bán. meta.missingCount = 0 nghĩa là đã đủ. Phân trang. " + READ_ONLY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["NUMBER", "ANY_FIELD"], description: "Tuỳ chọn. Mặc định NUMBER" },
        fromDate: { type: "string", description: "Tuỳ chọn. Từ ngày phiếu (YYYY-MM-DD)" },
        toDate: { type: "string", description: "Tuỳ chọn. Đến ngày phiếu (YYYY-MM-DD)" },
        warehouseId: { type: "string", description: "Tuỳ chọn. ID kho" },
        supplierId: { type: "string", description: "Tuỳ chọn. ID nhà cung cấp" },
        ...PAGINATION_PROPERTIES
      },
      required: []
    },
    handler: (args) => fetchReport("receipts-without-invoice", args, ["mode", "fromDate", "toDate", "warehouseId", "supplierId"])
  },

  {
    name: "get_invoice_date_warnings",
    description:
      "Cảnh báo ngày hóa đơn: các dòng xuất đã trừ lô có hóa đơn mua đứng sau ngày hóa đơn bán (bình quân gia quyền chỉ cảnh báo, không chặn). " +
      "Có ngày hóa đơn lô, ngày hóa đơn bán (hoặc ngày phiếu xuất nếu chưa có) và số ngày lệch. " + READ_ONLY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Tuỳ chọn. Từ ngày phiếu xuất (YYYY-MM-DD)" },
        toDate: { type: "string", description: "Tuỳ chọn. Đến ngày phiếu xuất (YYYY-MM-DD)" },
        projectId: { type: "string", description: "Tuỳ chọn. ID dự án" },
        materialId: { type: "string", description: "Tuỳ chọn. ID vật tư" },
        warehouseId: { type: "string", description: "Tuỳ chọn. ID kho" },
        includeCancelled: { type: "boolean", description: "Tuỳ chọn. Gồm cả phiếu xuất đã hủy, mặc định false" },
        ...PAGINATION_PROPERTIES
      },
      required: []
    },
    handler: (args) =>
      fetchReport("invoice-date-warnings", args, ["fromDate", "toDate", "projectId", "materialId", "warehouseId", "includeCancelled"])
  }
];

/**
 * Aliases of the PR 1 invoice tools (same handler, same behaviour) under the names used by the
 * invoice-automation scripts: update_receipt_invoice_info / bulk_update_receipt_invoice_info.
 */
const ALIAS_TARGETS: Array<{ alias: string; target: string }> = [
  { alias: "update_receipt_invoice_info", target: "update_receipt_invoice" },
  { alias: "bulk_update_receipt_invoice_info", target: "bulk_set_receipt_invoices" }
];

const aliasTools: McpTool[] = ALIAS_TARGETS.flatMap(({ alias, target }) => {
  const base = inventoryTools.find((tool) => tool.name === target);
  return base ? [{ ...base, name: alias, description: `[Bí danh của ${target}] ${base.description}` }] : [];
});

export const inventoryReportsTools: McpTool[] = [...inventoryReportTools, ...aliasTools];
