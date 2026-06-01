import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDate, formatDateTime, formatVND } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const STOCK_DOC_STATUS_LABEL: Record<string, string> = {
  DRAFT: "📝 Nháp",
  CONFIRMED: "✅ Đã xác nhận",
  CANCELLED: "❌ Đã huỷ"
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
      if (args["supplierId"]) params["supplierId"] = args["supplierId"];
      if (args["status"]) params["status"] = args["status"];

      const res = await client.get<unknown>("/stock-receipts", { params });
      const items = extractData<StockReceiptListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có phiếu nhập kho phù hợp.";

      const lines = items.map((receipt, index) => {
        const status = STOCK_DOC_STATUS_LABEL[receipt.status ?? ""] ?? receipt.status ?? "—";
        return (
          `${index + 1}. 📥 **${receipt.receiptNo}** ${status} | ID: \`${receipt.id}\`\n` +
          `   Kho: ${receipt.warehouse?.name ?? "—"} | NCC: ${receipt.supplier?.name ?? "—"} | ${formatVND(receipt.totalAmount)} | ${formatDate(receipt.date)}`
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

      if (receipt.items?.length) {
        out += `\n📦 **Vật tư nhập:**\n`;
        out += receipt.items
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
    name: "create_stock_receipt",
    description:
      "Tạo phiếu nhập kho nháp từ danh sách vật tư. Tồn kho chỉ tăng sau khi gọi confirm_stock_receipt.",
    inputSchema: {
      type: "object",
      properties: {
        warehouseId: { type: "string", description: "ID kho nhập" },
        supplierId: { type: "string", description: "ID nhà cung cấp" },
        date: { type: "string", description: "Ngày nhập, ISO date/datetime. Nếu thiếu dùng hôm nay." },
        notes: { type: "string", description: "Ghi chú phiếu nhập" },
        items: {
          type: "array",
          description: "Danh sách vật tư nhập",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "ID vật tư" },
              quantity: { type: "number", description: "Số lượng nhập" },
              unitPrice: { type: "number", description: "Đơn giá nhập VND" }
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

      const createRes = await client.post<unknown>("/stock-receipts", payload);
      const created = extractData<{ id: string; receiptNo: string }>(createRes.data);

      return (
        `✅ Đã tạo phiếu nhập kho nháp **${created.receiptNo}**\n` +
        `ID: \`${created.id}\`\n` +
        `💡 Dùng confirm_stock_receipt để xác nhận và cập nhật tồn kho.`
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
      const receipt = extractData<{ id: string; receiptNo: string; status: string }>(res.data);

      return `✅ Đã xác nhận phiếu nhập **${receipt.receiptNo}**\nID: \`${receipt.id}\` | Trạng thái: ${receipt.status}`;
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

interface StockReceiptListItem {
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
