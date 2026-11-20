import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDate, formatDateTime, formatVND } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const STOCK_DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "📝 Nháp",
  CONFIRMED: "✅ Đã xác nhận",
  CANCELLED: "❌ Đã huỷ"
};

const INVOICE_INPUT_PROPERTIES = {
  purchaseInvoiceNo: { type: "string", description: "Tuỳ chọn. Số hóa đơn dạng tự do (cũ). Nếu bỏ trống mà có invoiceNumber, hệ thống tự ghép ký hiệu-số." },
  invoiceSeries: { type: "string", description: "Tuỳ chọn. Ký hiệu hóa đơn, VD C26TAA" },
  invoiceNumber: { type: "string", description: "Tuỳ chọn. Số hóa đơn, VD 0000123" },
  invoiceDate: { type: "string", description: "Tuỳ chọn. Ngày hóa đơn (ISO date); dùng làm ngày hóa đơn mua của lô nhập" },
  sellerTaxCode: { type: "string", description: "Tuỳ chọn. MST người bán; bỏ trống thì lấy MST của nhà cung cấp" },
  invoiceFileRef: { type: "string", description: "Tuỳ chọn. Đường dẫn/tham chiếu file hóa đơn" },
  invoiceLookupCode: { type: "string", description: "Tuỳ chọn. Mã tra cứu hóa đơn điện tử" },
  invoiceType: { type: "string", enum: ["NORMAL", "REPLACEMENT", "ADJUSTMENT"], description: "Tuỳ chọn. Loại hóa đơn: gốc / thay thế / điều chỉnh. Mặc định NORMAL" },
  relatedInvoiceRef: { type: "string", description: "Tuỳ chọn. Hóa đơn liên quan (khi thay thế/điều chỉnh)" }
};

export const inventoryTools: McpTool[] = [
  {
    name: "list_warehouses",
    description:
      "Danh sách/tìm kiếm kho hàng trong AHSO CRM. " +
      "Dùng khi: 'Kho nào đang hoạt động?', 'Lấy ID kho để nhập hàng'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khoá theo mã hoặc tên kho" },
        isActive: { type: "boolean", description: "Lọc kho đang hoạt động/ngưng" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        page: 1,
        limit: args["limit"] ?? 10
      };
      if (args["query"]) params["search"] = args["query"];
      if (args["isActive"] !== undefined) params["isActive"] = args["isActive"];

      const res = await client.get<unknown>("/warehouses", { params });
      const items = extractData<WarehouseListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy kho nào.";

      const lines = items.map((warehouse, index) => {
        const status = warehouse.isActive ? "Hoạt động" : "Ngưng";
        return (
          `${index + 1}. 🏬 **${warehouse.name}** (${warehouse.code}) | ID: \`${warehouse.id}\`\n` +
          `   Trạng thái: ${status} | Vật tư có tồn: ${warehouse._count?.stockBalances ?? 0}`
        );
      });

      return `🏬 **Kho hàng** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_warehouse_detail",
    description:
      "Xem chi tiết kho: quản lý kho và top vật tư đang tồn. " +
      "Dùng khi: 'Chi tiết kho [ID]', 'Kho chính còn vật tư gì?'.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho lấy từ list_warehouses" }
      },
      required: ["warehouseId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/warehouses/${args["warehouseId"] as string}`);
      const warehouse = extractData<WarehouseDetail>(res.data);

      let out = `🏬 **${warehouse.name}** (${warehouse.code})\n`;
      out += `ID: \`${warehouse.id}\` | Trạng thái: ${warehouse.isActive ? "Hoạt động" : "Ngưng"}\n`;
      if (warehouse.address) out += `Địa chỉ: ${warehouse.address}\n`;
      if (warehouse.manager) out += `Quản lý: ${warehouse.manager.name} | ID: \`${warehouse.manager.id}\`\n`;

      if (warehouse.stockBalances?.length) {
        out += `\n📦 **Top tồn kho:**\n`;
        out += warehouse.stockBalances
          .map((balance) => `  • ${balance.material?.name ?? "—"} (${balance.material?.code ?? "—"}) | ID vật tư: \`${balance.material?.id ?? balance.materialId}\` | ${balance.quantity} ${balance.material?.unit ?? ""}`)
          .join("\n");
      }

      return out;
    }
  },

  {
    name: "create_warehouse",
    description:
      "Tạo kho mới. Dùng khi user cung cấp mã kho và tên kho rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Mã kho, bắt buộc" },
        name: { type: "string", description: "Tên kho, bắt buộc" },
        address: { type: "string", description: "Địa chỉ kho" },
        managerId: { type: "string", description: "ID người quản lý kho" },
        isActive: { type: "boolean", description: "Trạng thái hoạt động" }
      },
      required: ["code", "name"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = buildWarehousePayload(args);
      const res = await client.post<unknown>("/warehouses", payload);
      const warehouse = extractData<{ id: string; code: string; name: string }>(res.data);

      return `✅ Đã tạo kho **${warehouse.name}** (${warehouse.code})\nID: \`${warehouse.id}\``;
    }
  },

  {
    name: "update_warehouse",
    description:
      "Cập nhật kho hàng hiện có. Dùng khi đã có warehouseId từ list_warehouses.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho" },
        code: { type: "string", description: "Mã kho" },
        name: { type: "string", description: "Tên kho" },
        address: { type: "string", description: "Địa chỉ" },
        managerId: { type: "string", description: "ID quản lý kho" },
        isActive: { type: "boolean", description: "Hoạt động hay ngưng" }
      },
      required: ["warehouseId"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = buildWarehousePayload(args);
      const res = await client.patch<unknown>(`/warehouses/${args["warehouseId"] as string}`, payload);
      const warehouse = extractData<{ id: string; code: string; name: string }>(res.data);

      return `✅ Đã cập nhật kho **${warehouse.name}** (${warehouse.code})\nID: \`${warehouse.id}\``;
    }
  },

  {
    name: "get_inventory_summary",
    description:
      "Xem tổng quan tồn kho: tổng giá trị tồn, số vật tư dưới tồn min, số phiếu nháp. " +
      "Dùng khi: 'Tình hình tồn kho hiện tại?', 'Có vật tư nào sắp hết không?'.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    async handler() {
      const client = getApiClient();
      const res = await client.get<unknown>("/inventory/summary");
      const summary = extractData<InventorySummary>(res.data);

      return (
        `📊 **Tổng quan kho**\n` +
        `💰 Giá trị tồn: ${formatVND(summary.totalValue)}\n` +
        `⚠️ Vật tư dưới tồn min: ${summary.lowStockCount}\n` +
        `📝 Phiếu nháp: ${summary.draftDocsCount}\n` +
        `🏬 Kho đang hoạt động: ${summary.warehouseCount}`
      );
    }
  },

  {
    name: "delete_warehouse",
    description:
      "Xoá mềm kho theo ID. Chỉ dùng khi user yêu cầu xoá rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho cần xoá" }
      },
      required: ["warehouseId"]
    },
    async handler(args) {
      const client = getApiClient();
      const warehouseId = args["warehouseId"] as string;
      await client.delete<unknown>(`/warehouses/${warehouseId}`);

      return `✅ Đã xoá kho ID: \`${warehouseId}\``;
    }
  },

  {
    name: "get_inventory_balances",
    description:
      "Tra cứu tồn kho theo kho/vật tư. " +
      "Dùng khi: 'Vật tư X còn bao nhiêu?', 'Tồn kho kho chính', 'Danh sách vật tư dưới tồn min'.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho" },
        materialId: { type: "string", description: "ID vật tư" },
        projectId: {
          type: "string",
          description:
            "Tuỳ chọn. Chỉ tính tồn thuộc các lô nhập đã gắn dự án này (tổng số lượng còn lại của lô). Bỏ trống = toàn bộ tồn kho như cũ."
        },
        lowStockOnly: { type: "boolean", description: "Chỉ hiển thị tồn dưới min" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        page: 1,
        limit: args["limit"] ?? 10
      };
      if (args["warehouseId"]) params["warehouseId"] = args["warehouseId"];
      if (args["materialId"]) params["materialId"] = args["materialId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];
      if (args["lowStockOnly"] !== undefined) params["lowStockOnly"] = args["lowStockOnly"];

      const res = await client.get<unknown>("/inventory/balances", { params });
      const items = extractData<InventoryBalanceItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có tồn kho phù hợp bộ lọc.";

      const lines = items.map((balance, index) => {
        const lowStock = balance.isLowStock ? " ⚠️ dưới tồn min" : "";
        return (
          `${index + 1}. ${balance.material?.name ?? "—"} (${balance.material?.code ?? "—"}) | ID vật tư: \`${balance.materialId}\`\n` +
          `   Kho: ${balance.warehouse?.name ?? "—"} | ID kho: \`${balance.warehouseId}\` | Tồn: ${balance.quantity} ${balance.material?.unit ?? ""}${lowStock}`
        );
      });

      return `📦 **Tồn kho** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "list_stock_receipts",
    description:
      "Danh sách phiếu nhập kho. " +
      "Dùng khi: 'Phiếu nhập kho hôm nay', 'Phiếu nhập nháp', 'Lấy ID phiếu nhập để xác nhận'.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho" },
        supplierId: { type: "string", description: "ID nhà cung cấp" },
        status: { type: "string", enum: ["DRAFT", "CONFIRMED", "CANCELLED"], description: "Trạng thái phiếu" },
        invoiceNumber: { type: "string", description: "Tuỳ chọn. Lọc theo số hóa đơn (chứa chuỗi này)" },
        invoiceSeries: { type: "string", description: "Tuỳ chọn. Lọc theo ký hiệu hóa đơn" },
        sellerTaxCode: { type: "string", description: "Tuỳ chọn. Lọc theo MST người bán" },
        invoiceDateFrom: { type: "string", description: "Tuỳ chọn. Ngày hóa đơn từ (ISO date)" },
        invoiceDateTo: { type: "string", description: "Tuỳ chọn. Ngày hóa đơn đến (ISO date)" },
        hasInvoice: { type: "boolean", description: "Tuỳ chọn. true = đã có số hóa đơn, false = chưa có" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params = buildReceiptListParams(args);

      const res = await client.get<unknown>("/stock-receipts", { params });
      const items = extractData<StockReceiptListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có phiếu nhập kho phù hợp.";

      const lines = items.map((receipt, index) => {
        const status = STOCK_DOC_STATUS_LABEL[receipt.status ?? ""] ?? receipt.status ?? "—";
        return (
          `${index + 1}. 📥 **${receipt.receiptNo}** ${status} | ID: \`${receipt.id}\`\n` +
          `   Kho: ${receipt.warehouse?.name ?? "—"} | NCC: ${receipt.supplier?.name ?? "—"} | ${formatVND(receipt.totalAmount)} | ${formatDate(receipt.date)}` +
          invoiceSuffix(receipt)
        );
      });

      return `📥 **Phiếu nhập kho** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_stock_receipt_detail",
    description:
      "Xem chi tiết phiếu nhập kho theo ID, gồm danh sách vật tư.",
    inputSchema: {
      type: "object",
      properties: {
        receiptId: { type: "string", description: "ID phiếu nhập kho" }
      },
      required: ["receiptId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/stock-receipts/${args["receiptId"] as string}`);
      const receipt = extractData<StockReceiptDetail>(res.data);

      const status = STOCK_DOC_STATUS_LABEL[receipt.status ?? ""] ?? receipt.status ?? "—";
      let out = `📥 **${receipt.receiptNo}** ${status}\n`;
      out += `ID: \`${receipt.id}\` | Ngày: ${formatDate(receipt.date)} | Tổng: ${formatVND(receipt.totalAmount)}\n`;
      out += `Kho: ${receipt.warehouse?.name ?? "—"} | ID kho: \`${receipt.warehouse?.id ?? receipt.warehouseId}\`\n`;
      if (receipt.supplier) out += `NCC: ${receipt.supplier.name} | ID NCC: \`${receipt.supplier.id}\`\n`;
      if (receipt.confirmedAt) out += `Xác nhận: ${formatDateTime(receipt.confirmedAt)}\n`;
      out += formatInvoiceBlock(receipt);

      if (receipt.items?.length) {
        out += `\n📦 **Vật tư nhập:**\n`;
        out += receipt.items
          .map((item, index) => (
            `  ${index + 1}. ${item.material?.name ?? "—"} | ID vật tư: \`${item.materialId}\` | ` +
            `${item.quantity} ${item.material?.unit ?? ""} × ${formatVND(item.unitPrice)} = ${formatVND(item.total)}` +
            (item.project ? ` | Dự án: ${item.project.name} (\`${item.project.id}\`)` : "")
          ))
          .join("\n");
      }

      return out;
    }
  },

  {
    name: "create_stock_receipt",
    description:
      "Tạo phiếu nhập kho nháp từ danh sách vật tư. Tồn kho chỉ tăng sau khi gọi confirm_stock_receipt. " +
      "Có thể kèm hóa đơn mua (invoiceSeries, invoiceNumber, invoiceDate, sellerTaxCode…): cùng MST + ký hiệu + số hóa đơn đã có trên phiếu khác (chưa hủy) sẽ bị từ chối kèm ID phiếu cũ. " +
      "NCC loại Dịch vụ/Chi phí không được nhập kho. Mỗi dòng có thể gắn projectId (hàng mua riêng cho dự án).",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho nhập" },
        supplierId: { type: "string", description: "ID nhà cung cấp" },
        date: { type: "string", description: "Ngày nhập, ISO date/datetime. Nếu thiếu dùng hôm nay." },
        notes: { type: "string", description: "Ghi chú phiếu nhập" },
        ...INVOICE_INPUT_PROPERTIES,
        items: {
          type: "array",
          description: "Danh sách vật tư nhập",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "ID vật tư" },
              quantity: { type: "number", description: "Số lượng nhập" },
              unitPrice: { type: "number", description: "Đơn giá nhập VND" },
              projectId: {
                type: "string",
                description:
                  "Tuỳ chọn. ID dự án nếu hàng này mua riêng cho dự án đó; lô nhập sẽ gắn dự án, khi xuất cho dự án khác sẽ không bị lấy nhầm."
              }
            },
            required: ["materialId", "quantity", "unitPrice"]
          }
        }
      },
      required: ["warehouseId", "items"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        warehouseId: args["warehouseId"],
        date: args["date"] ?? new Date().toISOString(),
        items: args["items"]
      };
      if (args["supplierId"]) payload["supplierId"] = args["supplierId"];
      if (args["notes"]) payload["notes"] = args["notes"];
      Object.assign(payload, pickInvoiceFields(args));

      const createRes = await client.post<unknown>("/stock-receipts", payload);
      const created = extractData<{ id: string; receiptNo: string; warnings?: string[] }>(createRes.data);

      return (
        `✅ Đã tạo phiếu nhập kho nháp **${created.receiptNo}**\n` +
        `ID: \`${created.id}\`\n` +
        formatWarnings(created.warnings) +
        `💡 Dùng confirm_stock_receipt để xác nhận và cập nhật tồn kho.`
      );
    }
  },

  {
    name: "find_receipt_by_invoice",
    description:
      "Tìm phiếu nhập kho theo thông tin hóa đơn mua (số, ký hiệu, MST người bán). " +
      "Dùng khi: 'Hóa đơn 0000123 đã nhập chưa?', 'Phiếu nhập nào đang giữ hóa đơn này?'. Cần ít nhất một tham số.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string", description: "Số hóa đơn" },
        invoiceSeries: { type: "string", description: "Ký hiệu hóa đơn" },
        sellerTaxCode: { type: "string", description: "MST người bán" },
        invoiceDateFrom: { type: "string", description: "Ngày hóa đơn từ (ISO date)" },
        invoiceDateTo: { type: "string", description: "Ngày hóa đơn đến (ISO date)" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const keys = ["invoiceNumber", "invoiceSeries", "sellerTaxCode", "invoiceDateFrom", "invoiceDateTo"];
      if (!keys.some((key) => args[key])) {
        return "⚠️ Cần truyền ít nhất một trong: invoiceNumber, invoiceSeries, sellerTaxCode, invoiceDateFrom, invoiceDateTo.";
      }
      const client = getApiClient();
      const params = buildReceiptListParams(args);
      const res = await client.get<unknown>("/stock-receipts", { params });
      const items = extractData<StockReceiptListItem[]>(res.data);

      if (!items.length) return "📭 Không có phiếu nhập nào mang hóa đơn này.";

      const lines = items.map((receipt, index) => {
        const status = STOCK_DOC_STATUS_LABEL[receipt.status ?? ""] ?? receipt.status ?? "—";
        return (
          `${index + 1}. 📥 **${receipt.receiptNo}** ${status} | ID: \`${receipt.id}\`\n` +
          `   NCC: ${receipt.supplier?.name ?? "—"} | ${formatVND(receipt.totalAmount)} | ${formatDate(receipt.date)}` +
          invoiceSuffix(receipt)
        );
      });
      return `🧾 **Phiếu nhập theo hóa đơn** (${items.length}):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "update_receipt_invoice",
    description:
      "Bổ sung/sửa thông tin hóa đơn mua của một phiếu nhập — kể cả phiếu đã xác nhận. CHỈ sửa hóa đơn, không đụng dòng hàng, số lượng, đơn giá hay tồn kho. " +
      "Trùng (MST + ký hiệu + số) với phiếu khác sẽ bị từ chối kèm ID phiếu cũ. Đổi ngày hóa đơn của phiếu đã xác nhận chỉ được khi các lô chưa bị xuất/chuyển.",
    inputSchema: {
      type: "object",
      properties: {
        receiptId: { type: "string", description: "ID phiếu nhập kho" },
        ...INVOICE_INPUT_PROPERTIES
      },
      required: ["receiptId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.patch<unknown>(
        `/stock-receipts/${args["receiptId"] as string}/invoice`,
        pickInvoiceFields(args)
      );
      const receipt = extractData<{ id: string; receiptNo: string; lotsUpdated?: number } & InvoiceFields>(res.data);

      return (
        `✅ Đã cập nhật hóa đơn cho phiếu **${receipt.receiptNo}**\nID: \`${receipt.id}\`\n` +
        formatInvoiceBlock(receipt) +
        (receipt.lotsUpdated ? `Đã đồng bộ ${receipt.lotsUpdated} lô nhập.` : "")
      ).trimEnd();
    }
  },

  {
    name: "bulk_set_receipt_invoices",
    description:
      "Nhập hàng loạt hóa đơn cho nhiều phiếu nhập cũ. Mỗi dòng xử lý độc lập: dòng lỗi/trùng không làm dừng cả lô; kết quả trả về theo từng dòng (UPDATED / DUPLICATE / NOT_FOUND / ERROR). Tối đa 500 dòng.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Mỗi dòng cần receiptId hoặc receiptNo (VD PN-2026-005) cùng thông tin hóa đơn",
          items: {
            type: "object",
            properties: {
              receiptId: { type: "string", description: "ID phiếu nhập" },
              receiptNo: { type: "string", description: "Số phiếu nhập, dùng khi không có ID" },
              ...INVOICE_INPUT_PROPERTIES
            }
          }
        }
      },
      required: ["items"]
    },
    async handler(args) {
      const client = getApiClient();
      const rows = ((args["items"] as Array<Record<string, unknown>>) ?? []).map((row) => ({
        ...(row["receiptId"] ? { receiptId: row["receiptId"] } : {}),
        ...(row["receiptNo"] ? { receiptNo: row["receiptNo"] } : {}),
        ...pickInvoiceFields(row)
      }));
      const res = await client.post<unknown>("/stock-receipts/invoices/bulk", { items: rows });
      const out = extractData<BulkInvoiceResult>(res.data);

      const ICON: Record<string, string> = { UPDATED: "✅", DUPLICATE: "⚠️", NOT_FOUND: "❓", ERROR: "❌" };
      const lines = out.results.map((row) => {
        const ref = row.receiptNo ?? row.receiptId ?? `dòng ${row.index + 1}`;
        const dup = row.existingReceiptId ? ` (đang ở ${row.existingReceiptNo ?? "—"} | ID: \`${row.existingReceiptId}\`)` : "";
        return `${ICON[row.status] ?? "•"} #${row.index + 1} ${ref}: ${row.message}${dup}`;
      });
      const sum = out.summary;
      return (
        `🧾 **Kết quả nhập hóa đơn hàng loạt:** ${sum.updated}/${sum.total} cập nhật, ${sum.duplicate} trùng, ${sum.notFound} không tìm thấy, ${sum.error} lỗi\n\n` +
        lines.join("\n")
      );
    }
  },

  {
    name: "confirm_stock_receipt",
    description:
      "Xác nhận phiếu nhập kho DRAFT để tăng tồn kho. Chỉ dùng khi user yêu cầu xác nhận rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        receiptId: { type: "string", description: "ID phiếu nhập kho" }
      },
      required: ["receiptId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-receipts/${args["receiptId"] as string}/confirm`);
      const receipt = extractData<{ id: string; receiptNo: string; status: string; warnings?: string[] }>(res.data);

      return (
        `✅ Đã xác nhận phiếu nhập **${receipt.receiptNo}**\nID: \`${receipt.id}\` | Trạng thái: ${receipt.status}` +
        (receipt.warnings?.length ? `\n${formatWarnings(receipt.warnings).trimEnd()}` : "")
      );
    }
  },

  {
    name: "cancel_stock_receipt",
    description:
      "Huỷ phiếu nhập kho DRAFT. Chỉ dùng khi user yêu cầu huỷ rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        receiptId: { type: "string", description: "ID phiếu nhập kho" }
      },
      required: ["receiptId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-receipts/${args["receiptId"] as string}/cancel`);
      const receipt = extractData<{ id: string; receiptNo: string; status: string }>(res.data);

      return `✅ Đã huỷ phiếu nhập **${receipt.receiptNo}**\nID: \`${receipt.id}\``;
    }
  },

  {
    name: "list_stock_issues",
    description:
      "Danh sách phiếu xuất kho. Dùng khi: 'Phiếu xuất kho hôm nay', 'Phiếu xuất nháp', 'Lấy ID phiếu xuất để xác nhận'.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho xuất" },
        projectId: { type: "string", description: "ID dự án liên quan" },
        status: { type: "string", enum: ["DRAFT", "CONFIRMED", "CANCELLED"], description: "Trạng thái phiếu" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        page: 1,
        limit: args["limit"] ?? 10
      };
      if (args["warehouseId"]) params["warehouseId"] = args["warehouseId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];
      if (args["status"]) params["status"] = args["status"];

      const res = await client.get<unknown>("/stock-issues", { params });
      const items = extractData<StockIssueListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có phiếu xuất kho phù hợp.";

      const lines = items.map((issue, index) => {
        const status = STOCK_DOC_STATUS_LABEL[issue.status ?? ""] ?? issue.status ?? "—";
        return (
          `${index + 1}. 📤 **${issue.issueNo}** ${status} | ID: \`${issue.id}\`\n` +
          `   Kho: ${issue.warehouse?.name ?? "—"} | Dự án: ${issue.project?.name ?? "—"} | ${formatVND(issue.totalAmount)} | ${formatDate(issue.date)}`
        );
      });

      return `📤 **Phiếu xuất kho** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_stock_issue_detail",
    description:
      "Xem chi tiết phiếu xuất kho theo ID, gồm danh sách vật tư.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: { type: "string", description: "ID phiếu xuất kho" }
      },
      required: ["issueId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/stock-issues/${args["issueId"] as string}`);
      const issue = extractData<StockIssueDetail>(res.data);

      const status = STOCK_DOC_STATUS_LABEL[issue.status ?? ""] ?? issue.status ?? "—";
      let out = `📤 **${issue.issueNo}** ${status}\n`;
      out += `ID: \`${issue.id}\` | Ngày: ${formatDate(issue.date)} | Tổng: ${formatVND(issue.totalAmount)}\n`;
      out += `Kho: ${issue.warehouse?.name ?? "—"} | ID kho: \`${issue.warehouse?.id ?? issue.warehouseId}\`\n`;
      if (issue.project) out += `Dự án: ${issue.project.name} | ID dự án: \`${issue.project.id}\`\n`;
      if (issue.reason) out += `Lý do: ${issue.reason}\n`;
      if (issue.confirmedAt) out += `Xác nhận: ${formatDateTime(issue.confirmedAt)}\n`;

      if (issue.items?.length) {
        out += `\n📦 **Vật tư xuất:**\n`;
        out += issue.items
          .map((item, index) => (
            `  ${index + 1}. ${item.material?.name ?? "—"} | ID vật tư: \`${item.materialId}\` | ` +
            `${item.quantity} ${item.material?.unit ?? ""} × ${formatVND(item.unitPrice)} = ${formatVND(item.total)}`
          ))
          .join("\n");
      }

      return out;
    }
  },

  {
    name: "create_stock_issue",
    description:
      "Tạo phiếu xuất kho nháp. Tồn kho chỉ giảm sau khi gọi confirm_stock_issue.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho xuất" },
        projectId: { type: "string", description: "ID dự án liên quan nếu có" },
        date: { type: "string", description: "Ngày xuất, ISO date/datetime. Nếu thiếu dùng hôm nay." },
        reason: { type: "string", description: "Lý do xuất kho" },
        notes: { type: "string", description: "Ghi chú phiếu xuất" },
        items: {
          type: "array",
          description: "Danh sách vật tư xuất",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "ID vật tư" },
              quantity: { type: "number", description: "Số lượng xuất" },
              unitPrice: { type: "number", description: "Đơn giá xuất VND" }
            },
            required: ["materialId", "quantity", "unitPrice"]
          }
        }
      },
      required: ["warehouseId", "items"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        warehouseId: args["warehouseId"],
        date: args["date"] ?? new Date().toISOString(),
        items: args["items"]
      };
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["reason"]) payload["reason"] = args["reason"];
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>("/stock-issues", payload);
      const issue = extractData<{ id: string; issueNo: string }>(res.data);

      return (
        `✅ Đã tạo phiếu xuất kho nháp **${issue.issueNo}**\n` +
        `ID: \`${issue.id}\`\n` +
        `💡 Dùng confirm_stock_issue để xác nhận và cập nhật tồn kho.`
      );
    }
  },

  {
    name: "confirm_stock_issue",
    description:
      "Xác nhận phiếu xuất kho DRAFT để giảm tồn kho. Chỉ dùng khi user yêu cầu xác nhận rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: { type: "string", description: "ID phiếu xuất kho" }
      },
      required: ["issueId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-issues/${args["issueId"] as string}/confirm`);
      const issue = extractData<{ id: string; issueNo: string; status: string }>(res.data);

      return `✅ Đã xác nhận phiếu xuất **${issue.issueNo}**\nID: \`${issue.id}\` | Trạng thái: ${issue.status}`;
    }
  },

  {
    name: "cancel_stock_issue",
    description:
      "Huỷ phiếu xuất kho DRAFT. Chỉ dùng khi user yêu cầu huỷ rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: { type: "string", description: "ID phiếu xuất kho" }
      },
      required: ["issueId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-issues/${args["issueId"] as string}/cancel`);
      const issue = extractData<{ id: string; issueNo: string; status: string }>(res.data);

      return `✅ Đã huỷ phiếu xuất **${issue.issueNo}**\nID: \`${issue.id}\``;
    }
  },

  {
    name: "list_stock_transfers",
    description:
      "Danh sách phiếu chuyển kho. Dùng khi: 'Phiếu chuyển kho nháp', 'Chuyển kho gần đây'.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho xuất hoặc kho nhận" },
        fromWarehouseId: { type: "string", description: "ID kho xuất" },
        toWarehouseId: { type: "string", description: "ID kho nhận" },
        status: { type: "string", enum: ["DRAFT", "CONFIRMED", "CANCELLED"], description: "Trạng thái phiếu" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        page: 1,
        limit: args["limit"] ?? 10
      };
      if (args["warehouseId"]) params["warehouseId"] = args["warehouseId"];
      if (args["fromWarehouseId"]) params["fromWarehouseId"] = args["fromWarehouseId"];
      if (args["toWarehouseId"]) params["toWarehouseId"] = args["toWarehouseId"];
      if (args["status"]) params["status"] = args["status"];

      const res = await client.get<unknown>("/stock-transfers", { params });
      const items = extractData<StockTransferListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có phiếu chuyển kho phù hợp.";

      const lines = items.map((transfer, index) => {
        const status = STOCK_DOC_STATUS_LABEL[transfer.status ?? ""] ?? transfer.status ?? "—";
        return (
          `${index + 1}. 🔁 **${transfer.transferNo}** ${status} | ID: \`${transfer.id}\`\n` +
          `   Từ: ${transfer.fromWarehouse?.name ?? "—"} → Đến: ${transfer.toWarehouse?.name ?? "—"} | ${formatDate(transfer.date)}`
        );
      });

      return `🔁 **Phiếu chuyển kho** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_stock_transfer_detail",
    description:
      "Xem chi tiết phiếu chuyển kho theo ID, gồm vật tư chuyển.",
    inputSchema: {
      type: "object",
      properties: {
        transferId: { type: "string", description: "ID phiếu chuyển kho" }
      },
      required: ["transferId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/stock-transfers/${args["transferId"] as string}`);
      const transfer = extractData<StockTransferDetail>(res.data);

      const status = STOCK_DOC_STATUS_LABEL[transfer.status ?? ""] ?? transfer.status ?? "—";
      let out = `🔁 **${transfer.transferNo}** ${status}\n`;
      out += `ID: \`${transfer.id}\` | Ngày: ${formatDate(transfer.date)}\n`;
      out += `Từ kho: ${transfer.fromWarehouse?.name ?? "—"} | ID: \`${transfer.fromWarehouse?.id ?? transfer.fromWarehouseId}\`\n`;
      out += `Đến kho: ${transfer.toWarehouse?.name ?? "—"} | ID: \`${transfer.toWarehouse?.id ?? transfer.toWarehouseId}\`\n`;
      if (transfer.confirmedAt) out += `Xác nhận: ${formatDateTime(transfer.confirmedAt)}\n`;

      if (transfer.items?.length) {
        out += `\n📦 **Vật tư chuyển:**\n`;
        out += transfer.items
          .map((item, index) => (
            `  ${index + 1}. ${item.material?.name ?? "—"} | ID vật tư: \`${item.materialId}\` | ` +
            `${item.quantity} ${item.material?.unit ?? ""}`
          ))
          .join("\n");
      }

      return out;
    }
  },

  {
    name: "create_stock_transfer",
    description:
      "Tạo phiếu chuyển kho nháp. Tồn kho chỉ chuyển sau khi gọi confirm_stock_transfer.",
    inputSchema: {
      type: "object",
      properties: {
        fromWarehouseId: { type: "string", description: "ID kho xuất" },
        toWarehouseId: { type: "string", description: "ID kho nhận" },
        date: { type: "string", description: "Ngày chuyển, ISO date/datetime. Nếu thiếu dùng hôm nay." },
        notes: { type: "string", description: "Ghi chú phiếu chuyển" },
        items: {
          type: "array",
          description: "Danh sách vật tư chuyển",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "ID vật tư" },
              quantity: { type: "number", description: "Số lượng chuyển" }
            },
            required: ["materialId", "quantity"]
          }
        }
      },
      required: ["fromWarehouseId", "toWarehouseId", "items"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        fromWarehouseId: args["fromWarehouseId"],
        toWarehouseId: args["toWarehouseId"],
        date: args["date"] ?? new Date().toISOString(),
        items: args["items"]
      };
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>("/stock-transfers", payload);
      const transfer = extractData<{ id: string; transferNo: string }>(res.data);

      return (
        `✅ Đã tạo phiếu chuyển kho nháp **${transfer.transferNo}**\n` +
        `ID: \`${transfer.id}\`\n` +
        `💡 Dùng confirm_stock_transfer để xác nhận và cập nhật tồn kho.`
      );
    }
  },

  {
    name: "confirm_stock_transfer",
    description:
      "Xác nhận phiếu chuyển kho DRAFT để trừ kho nguồn và cộng kho đích. Chỉ dùng khi user yêu cầu xác nhận rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        transferId: { type: "string", description: "ID phiếu chuyển kho" }
      },
      required: ["transferId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-transfers/${args["transferId"] as string}/confirm`);
      const transfer = extractData<{ id: string; transferNo: string; status: string }>(res.data);

      return `✅ Đã xác nhận phiếu chuyển **${transfer.transferNo}**\nID: \`${transfer.id}\` | Trạng thái: ${transfer.status}`;
    }
  },

  {
    name: "cancel_stock_transfer",
    description:
      "Huỷ phiếu chuyển kho DRAFT. Chỉ dùng khi user yêu cầu huỷ rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        transferId: { type: "string", description: "ID phiếu chuyển kho" }
      },
      required: ["transferId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-transfers/${args["transferId"] as string}/cancel`);
      const transfer = extractData<{ id: string; transferNo: string; status: string }>(res.data);

      return `✅ Đã huỷ phiếu chuyển **${transfer.transferNo}**\nID: \`${transfer.id}\``;
    }
  },

  {
    name: "list_stock_counts",
    description:
      "Danh sách phiếu kiểm kho. Dùng khi: 'Phiếu kiểm kho nháp', 'Kiểm kho kho chính'.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho kiểm" },
        status: { type: "string", enum: ["DRAFT", "CONFIRMED", "CANCELLED"], description: "Trạng thái phiếu" },
        limit: { type: "number", description: "Số kết quả tối đa, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        page: 1,
        limit: args["limit"] ?? 10
      };
      if (args["warehouseId"]) params["warehouseId"] = args["warehouseId"];
      if (args["status"]) params["status"] = args["status"];

      const res = await client.get<unknown>("/stock-counts", { params });
      const items = extractData<StockCountListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có phiếu kiểm kho phù hợp.";

      const lines = items.map((count, index) => {
        const status = STOCK_DOC_STATUS_LABEL[count.status ?? ""] ?? count.status ?? "—";
        return (
          `${index + 1}. 🧮 **${count.countNo}** ${status} | ID: \`${count.id}\`\n` +
          `   Kho: ${count.warehouse?.name ?? "—"} | Số dòng: ${count._count?.items ?? 0} | ${formatDate(count.date)}`
        );
      });

      return `🧮 **Phiếu kiểm kho** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_stock_count_detail",
    description:
      "Xem chi tiết phiếu kiểm kho theo ID, gồm số lượng hệ thống, thực tế và chênh lệch.",
    inputSchema: {
      type: "object",
      properties: {
        countId: { type: "string", description: "ID phiếu kiểm kho" }
      },
      required: ["countId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/stock-counts/${args["countId"] as string}`);
      const count = extractData<StockCountDetail>(res.data);

      const status = STOCK_DOC_STATUS_LABEL[count.status ?? ""] ?? count.status ?? "—";
      let out = `🧮 **${count.countNo}** ${status}\n`;
      out += `ID: \`${count.id}\` | Ngày: ${formatDate(count.date)}\n`;
      out += `Kho: ${count.warehouse?.name ?? "—"} | ID kho: \`${count.warehouse?.id ?? count.warehouseId}\`\n`;
      if (count.confirmedAt) out += `Xác nhận: ${formatDateTime(count.confirmedAt)}\n`;

      if (count.items?.length) {
        out += `\n📦 **Dòng kiểm kho:**\n`;
        out += count.items
          .map((item, index) => (
            `  ${index + 1}. ${item.material?.name ?? "—"} | ID vật tư: \`${item.materialId}\` | ` +
            `Hệ thống: ${item.systemQuantity} | Thực tế: ${item.actualQuantity} | Lệch: ${item.diff}`
          ))
          .join("\n");
      }

      return out;
    }
  },

  {
    name: "create_stock_count",
    description:
      "Tạo phiếu kiểm kho nháp. Chênh lệch tồn kho chỉ áp dụng sau khi gọi confirm_stock_count.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho kiểm" },
        date: { type: "string", description: "Ngày kiểm, ISO date/datetime. Nếu thiếu dùng hôm nay." },
        notes: { type: "string", description: "Ghi chú phiếu kiểm" },
        items: {
          type: "array",
          description: "Danh sách vật tư kiểm kho",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "ID vật tư" },
              actualQuantity: { type: "number", description: "Số lượng thực tế kiểm được" }
            },
            required: ["materialId", "actualQuantity"]
          }
        }
      },
      required: ["warehouseId", "items"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        warehouseId: args["warehouseId"],
        date: args["date"] ?? new Date().toISOString(),
        items: args["items"]
      };
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>("/stock-counts", payload);
      const count = extractData<{ id: string; countNo: string }>(res.data);

      return (
        `✅ Đã tạo phiếu kiểm kho nháp **${count.countNo}**\n` +
        `ID: \`${count.id}\`\n` +
        `💡 Dùng confirm_stock_count để xác nhận và cập nhật chênh lệch tồn kho.`
      );
    }
  },

  {
    name: "confirm_stock_count",
    description:
      "Xác nhận phiếu kiểm kho DRAFT để áp dụng chênh lệch tồn kho. Chỉ dùng khi user yêu cầu xác nhận rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        countId: { type: "string", description: "ID phiếu kiểm kho" }
      },
      required: ["countId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-counts/${args["countId"] as string}/confirm`);
      const count = extractData<{ id: string; countNo: string; status: string }>(res.data);

      return `✅ Đã xác nhận phiếu kiểm kho **${count.countNo}**\nID: \`${count.id}\` | Trạng thái: ${count.status}`;
    }
  },

  {
    name: "cancel_stock_count",
    description:
      "Huỷ phiếu kiểm kho DRAFT. Chỉ dùng khi user yêu cầu huỷ rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        countId: { type: "string", description: "ID phiếu kiểm kho" }
      },
      required: ["countId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(`/stock-counts/${args["countId"] as string}/cancel`);
      const count = extractData<{ id: string; countNo: string; status: string }>(res.data);

      return `✅ Đã huỷ phiếu kiểm kho **${count.countNo}**\nID: \`${count.id}\``;
    }
  }
];

// ---- Purchase invoice helpers (shared by receipt tools) ----

const INVOICE_FIELD_NAMES = [
  "purchaseInvoiceNo",
  "invoiceSeries",
  "invoiceNumber",
  "invoiceDate",
  "sellerTaxCode",
  "invoiceFileRef",
  "invoiceLookupCode",
  "invoiceType",
  "relatedInvoiceRef"
];

function pickInvoiceFields(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const field of INVOICE_FIELD_NAMES) {
    if (args[field] !== undefined && args[field] !== null) payload[field] = args[field];
  }
  return payload;
}

function buildReceiptListParams(args: Record<string, unknown>) {
  const params: Record<string, unknown> = { page: 1, limit: args["limit"] ?? 10 };
  const fields = [
    "warehouseId",
    "supplierId",
    "status",
    "invoiceNumber",
    "invoiceSeries",
    "sellerTaxCode",
    "invoiceDateFrom",
    "invoiceDateTo"
  ];
  for (const field of fields) {
    if (args[field]) params[field] = args[field];
  }
  if (args["hasInvoice"] !== undefined) params["hasInvoice"] = args["hasInvoice"];
  return params;
}

function invoiceSuffix(receipt: InvoiceFields): string {
  const no = receipt.invoiceNumber
    ? `${receipt.invoiceSeries ? `${receipt.invoiceSeries}-` : ""}${receipt.invoiceNumber}`
    : receipt.purchaseInvoiceNo;
  return no ? `\n   🧾 HĐ: ${no}${receipt.invoiceDate ? ` (${formatDate(receipt.invoiceDate)})` : ""}` : "";
}

function formatInvoiceBlock(receipt: InvoiceFields): string {
  const lines: string[] = [];
  if (receipt.invoiceNumber || receipt.invoiceSeries) {
    lines.push(
      `🧾 Hóa đơn: ${receipt.invoiceSeries ?? "—"} / ${receipt.invoiceNumber ?? "—"}` +
        (receipt.invoiceDate ? ` | Ngày HĐ: ${formatDate(receipt.invoiceDate)}` : "")
    );
  } else if (receipt.purchaseInvoiceNo) {
    lines.push(`🧾 Số hóa đơn (nhập tay): ${receipt.purchaseInvoiceNo}`);
  } else {
    lines.push("🧾 Hóa đơn: chưa có");
  }
  if (receipt.sellerTaxCode) lines.push(`MST người bán: ${receipt.sellerTaxCode}`);
  if (receipt.invoiceType && receipt.invoiceType !== "NORMAL") {
    lines.push(`Loại HĐ: ${receipt.invoiceType}${receipt.relatedInvoiceRef ? ` (liên quan: ${receipt.relatedInvoiceRef})` : ""}`);
  }
  if (receipt.invoiceLookupCode) lines.push(`Mã tra cứu: ${receipt.invoiceLookupCode}`);
  if (receipt.invoiceFileRef) lines.push(`File: ${receipt.invoiceFileRef}`);
  return lines.join("\n") + "\n";
}

function formatWarnings(warnings: string[] | undefined): string {
  return warnings?.length ? `⚠️ Cảnh báo: ${warnings.join("; ")}\n` : "";
}

function buildWarehousePayload(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  const fields = ["code", "name", "address", "managerId", "isActive"];
  for (const field of fields) {
    if (args[field] !== undefined && args[field] !== null) {
      payload[field] = args[field];
    }
  }
  return payload;
}

interface WarehouseListItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  _count?: { stockBalances?: number };
}

interface WarehouseDetail extends WarehouseListItem {
  address?: string | null;
  manager?: { id: string; name: string; email?: string | null } | null;
  stockBalances?: Array<{
    materialId: string;
    quantity: number;
    material?: { id: string; code: string; name: string; unit: string } | null;
  }>;
}

interface InventorySummary {
  totalValue: number;
  lowStockCount: number;
  draftDocsCount: number;
  warehouseCount: number;
}

interface InventoryBalanceItem {
  id: string;
  warehouseId: string;
  materialId: string;
  quantity: number;
  isLowStock?: boolean;
  warehouse?: { id: string; code: string; name: string } | null;
  material?: { id: string; code: string; name: string; unit: string } | null;
}

interface InvoiceFields {
  purchaseInvoiceNo?: string | null;
  invoiceSeries?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  sellerTaxCode?: string | null;
  invoiceFileRef?: string | null;
  invoiceLookupCode?: string | null;
  invoiceType?: string | null;
  relatedInvoiceRef?: string | null;
}

interface BulkInvoiceResult {
  results: Array<{
    index: number;
    receiptId: string | null;
    receiptNo: string | null;
    status: string;
    message: string;
    existingReceiptId?: string;
    existingReceiptNo?: string;
  }>;
  summary: { total: number; updated: number; duplicate: number; notFound: number; error: number };
}

interface StockReceiptListItem extends InvoiceFields {
  id: string;
  receiptNo: string;
  status: string;
  date: string;
  totalAmount: number;
  warehouse?: { id: string; code: string; name: string } | null;
  supplier?: { id: string; code: string; name: string } | null;
}

interface StockReceiptDetail extends StockReceiptListItem {
  warehouseId: string;
  confirmedAt?: string | null;
  items?: Array<{
    materialId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    project?: { id: string; name: string } | null;
    material?: { id: string; code: string; name: string; unit: string } | null;
  }>;
}

interface StockIssueListItem {
  id: string;
  issueNo: string;
  status: string;
  date: string;
  totalAmount: number;
  reason?: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  project?: { id: string; name: string } | null;
}

interface StockIssueDetail extends StockIssueListItem {
  warehouseId: string;
  confirmedAt?: string | null;
  items?: Array<{
    materialId: string;
    quantity: number;
    unitPrice: number;
    total: number;
    material?: { id: string; code: string; name: string; unit: string } | null;
  }>;
}

interface StockTransferListItem {
  id: string;
  transferNo: string;
  status: string;
  date: string;
  fromWarehouse?: { id: string; code: string; name: string } | null;
  toWarehouse?: { id: string; code: string; name: string } | null;
}

interface StockTransferDetail extends StockTransferListItem {
  fromWarehouseId: string;
  toWarehouseId: string;
  confirmedAt?: string | null;
  items?: Array<{
    materialId: string;
    quantity: number;
    material?: { id: string; code: string; name: string; unit: string } | null;
  }>;
}

interface StockCountListItem {
  id: string;
  countNo: string;
  status: string;
  date: string;
  warehouse?: { id: string; code: string; name: string } | null;
  _count?: { items?: number };
}

interface StockCountDetail extends StockCountListItem {
  warehouseId: string;
  confirmedAt?: string | null;
  items?: Array<{
    materialId: string;
    systemQuantity: number;
    actualQuantity: number;
    diff: number;
    material?: { id: string; code: string; name: string; unit: string } | null;
  }>;
}
