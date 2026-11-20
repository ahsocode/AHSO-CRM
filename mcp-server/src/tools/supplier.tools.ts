import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDate, truncate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const SUPPLIER_TYPE_ENUM = ["GOODS", "SERVICE", "EXPENSE", "OTHER"];
const SUPPLIER_TYPE_LABEL: Record<string, string> = {
  GOODS: "Hàng hóa",
  SERVICE: "Dịch vụ",
  EXPENSE: "Chi phí",
  OTHER: "Khác"
};
const SUPPLIER_TYPE_HELP =
  "Loại NCC: GOODS = hàng hóa (nhập kho được, mặc định), SERVICE = dịch vụ, EXPENSE = chi phí (xăng, taxi, nhà hàng…), OTHER = khác (nhập kho được nhưng có cảnh báo). NCC SERVICE/EXPENSE bị chặn khi nhập kho.";

export const supplierTools: McpTool[] = [
  {
    name: "list_suppliers",
    description:
      "Tìm kiếm/danh sách nhà cung cấp trong AHSO CRM. " +
      "Dùng khi: 'Tìm nhà cung cấp Horiba', 'Danh sách NCC đang hoạt động', 'Lấy ID nhà cung cấp'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khoá tìm theo tên, mã NCC hoặc MST" },
        isActive: { type: "boolean", description: "Lọc NCC đang hoạt động/ngưng" },
        supplierType: { type: "string", enum: SUPPLIER_TYPE_ENUM, description: "Tuỳ chọn. Lọc theo loại NCC (GOODS/SERVICE/EXPENSE/OTHER)" },
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
      if (args["supplierType"]) params["supplierType"] = args["supplierType"];

      const res = await client.get<unknown>("/suppliers", { params });
      const items = extractData<SupplierListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy nhà cung cấp nào.";

      const lines = items.map((supplier, index) => {
        const status = supplier.isActive ? "Đang hoạt động" : "Ngưng";
        return (
          `${index + 1}. 🧾 **${supplier.name}** (${supplier.code}) | ID: \`${supplier.id}\`\n` +
          `   Loại: ${SUPPLIER_TYPE_LABEL[supplier.supplierType ?? "GOODS"] ?? supplier.supplierType} | Trạng thái: ${status} | Liên hệ: ${supplier.contactName ?? "—"} | ĐT: ${supplier.phone ?? "—"}`
        );
      });

      return `🏭 **Nhà cung cấp** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_supplier_detail",
    description:
      "Xem chi tiết một nhà cung cấp theo ID. " +
      "Dùng khi: 'Chi tiết NCC [ID]', 'Thông tin nhà cung cấp Horiba'.",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "ID nhà cung cấp lấy từ list_suppliers" }
      },
      required: ["supplierId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/suppliers/${args["supplierId"] as string}`);
      const supplier = extractData<SupplierDetail>(res.data);

      let out = `🏭 **${supplier.name}** (${supplier.code})\n`;
      out += `ID: \`${supplier.id}\` | Trạng thái: ${supplier.isActive ? "Hoạt động" : "Ngưng"}\n`;
      out += `Loại NCC: ${SUPPLIER_TYPE_LABEL[supplier.supplierType ?? "GOODS"] ?? supplier.supplierType}\n`;
      if (supplier.taxCode) out += `MST: ${supplier.taxCode}\n`;
      if (supplier.contactName) out += `Người liên hệ: ${supplier.contactName}\n`;
      if (supplier.phone) out += `Điện thoại: ${supplier.phone}\n`;
      if (supplier.email) out += `Email: ${supplier.email}\n`;
      if (supplier.address) out += `Địa chỉ: ${supplier.address}\n`;
      if (supplier.notes) out += `\n📝 Ghi chú: ${truncate(supplier.notes, 300)}\n`;
      out += `\nCập nhật: ${formatDate(supplier.updatedAt)}`;

      return out;
    }
  },

  {
    name: "create_supplier",
    description:
      "Tạo nhà cung cấp mới. " +
      "Dùng khi user đã cung cấp mã NCC và tên NCC rõ ràng. Nếu thiếu mã, hãy hỏi lại trước.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Mã nhà cung cấp, bắt buộc" },
        name: { type: "string", description: "Tên nhà cung cấp, bắt buộc" },
        taxCode: { type: "string", description: "Mã số thuế" },
        address: { type: "string", description: "Địa chỉ" },
        phone: { type: "string", description: "Số điện thoại" },
        email: { type: "string", description: "Email" },
        contactName: { type: "string", description: "Người liên hệ" },
        notes: { type: "string", description: "Ghi chú" },
        supplierType: { type: "string", enum: SUPPLIER_TYPE_ENUM, description: "Tuỳ chọn. " + SUPPLIER_TYPE_HELP },
        isActive: { type: "boolean", description: "Trạng thái hoạt động, mặc định true" }
      },
      required: ["code", "name"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = buildSupplierPayload(args);
      const res = await client.post<unknown>("/suppliers", payload);
      const supplier = extractData<{ id: string; code: string; name: string }>(res.data);

      return `✅ Đã tạo nhà cung cấp **${supplier.name}** (${supplier.code})\nID: \`${supplier.id}\``;
    }
  },

  {
    name: "update_supplier",
    description:
      "Cập nhật nhà cung cấp hiện có. " +
      "Dùng khi: 'Cập nhật số điện thoại NCC [ID]', 'Đổi email nhà cung cấp'.",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "ID nhà cung cấp" },
        code: { type: "string", description: "Mã NCC mới" },
        name: { type: "string", description: "Tên NCC mới" },
        taxCode: { type: "string", description: "MST" },
        address: { type: "string", description: "Địa chỉ" },
        phone: { type: "string", description: "Số điện thoại" },
        email: { type: "string", description: "Email" },
        contactName: { type: "string", description: "Người liên hệ" },
        notes: { type: "string", description: "Ghi chú" },
        supplierType: { type: "string", enum: SUPPLIER_TYPE_ENUM, description: "Tuỳ chọn. " + SUPPLIER_TYPE_HELP },
        isActive: { type: "boolean", description: "Hoạt động hay ngưng" }
      },
      required: ["supplierId"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = buildSupplierPayload(args);
      const res = await client.patch<unknown>(`/suppliers/${args["supplierId"] as string}`, payload);
      const supplier = extractData<{ id: string; code: string; name: string }>(res.data);

      return `✅ Đã cập nhật nhà cung cấp **${supplier.name}** (${supplier.code})\nID: \`${supplier.id}\``;
    }
  },

  {
    name: "bulk_update_supplier_types",
    description:
      "Phân loại nhà cung cấp hàng loạt (GOODS/SERVICE/EXPENSE/OTHER). " +
      "Mỗi dòng xử lý độc lập, kết quả trả về theo từng dòng (UPDATED / UNCHANGED / NOT_FOUND / ERROR). Tối đa 500 dòng. " + SUPPLIER_TYPE_HELP,
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Danh sách NCC cần đổi loại",
          items: {
            type: "object",
            properties: {
              supplierId: { type: "string", description: "ID nhà cung cấp" },
              supplierType: { type: "string", enum: SUPPLIER_TYPE_ENUM, description: "Loại NCC mới" }
            },
            required: ["supplierId", "supplierType"]
          }
        }
      },
      required: ["items"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.patch<unknown>("/suppliers/bulk-type", { items: args["items"] ?? [] });
      const out = extractData<BulkTypeResult>(res.data);

      const ICON: Record<string, string> = { UPDATED: "✅", UNCHANGED: "➖", NOT_FOUND: "❓", ERROR: "❌" };
      const lines = out.results.map(
        (row) => `${ICON[row.status] ?? "•"} #${row.index + 1} \`${row.supplierId}\`: ${row.message}` + (row.from && row.to && row.from !== row.to ? ` (${row.from} → ${row.to})` : "")
      );
      const sum = out.summary;
      return `🏭 **Kết quả phân loại NCC:** ${sum.updated}/${sum.total} cập nhật, ${sum.unchanged} không đổi, ${sum.notFound} không tìm thấy, ${sum.error} lỗi\n\n${lines.join("\n")}`;
    }
  },

  {
    name: "delete_supplier",
    description:
      "Xoá mềm nhà cung cấp theo ID. Chỉ dùng khi user yêu cầu xoá rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "string", description: "ID nhà cung cấp cần xoá" }
      },
      required: ["supplierId"]
    },
    async handler(args) {
      const client = getApiClient();
      const supplierId = args["supplierId"] as string;
      await client.delete<unknown>(`/suppliers/${supplierId}`);

      return `✅ Đã xoá nhà cung cấp ID: \`${supplierId}\``;
    }
  }
];

function buildSupplierPayload(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  const fields = ["code", "name", "taxCode", "address", "phone", "email", "contactName", "notes", "supplierType", "isActive"];
  for (const field of fields) {
    if (args[field] !== undefined && args[field] !== null) {
      payload[field] = args[field];
    }
  }
  return payload;
}

interface SupplierListItem {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  supplierType?: string;
  isActive: boolean;
}

interface BulkTypeResult {
  results: Array<{ index: number; supplierId: string; status: string; message: string; from?: string; to?: string }>;
  summary: { total: number; updated: number; unchanged: number; notFound: number; error: number };
}

interface SupplierDetail extends SupplierListItem {
  taxCode?: string | null;
  address?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
}
