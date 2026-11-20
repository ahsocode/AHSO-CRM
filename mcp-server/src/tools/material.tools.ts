import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatVND, truncate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const KIND_ENUM = ["STOCK", "SERVICE", "PRODUCT"];
const ACCOUNTING_CLASS_ENUM = ["RAW_MATERIAL", "TOOL", "MERCHANDISE", "FINISHED_GOOD", "CONSUMABLE_COMMON"];
const ACCOUNTING_CLASS_LABEL: Record<string, string> = {
  RAW_MATERIAL: "Nguyên vật liệu (TK152)",
  TOOL: "Công cụ dụng cụ (TK153)",
  MERCHANDISE: "Hàng hóa (TK156)",
  FINISHED_GOOD: "Thành phẩm (TK155)",
  CONSUMABLE_COMMON: "Vật tư phụ dùng chung"
};
const KIND_HELP =
  "Phân biệt: `kind` = có qua kho hay không (STOCK = hàng tồn kho, SERVICE = dịch vụ/nhân công không qua kho, PRODUCT = thành phẩm); " +
  "`accountingClass` = hạch toán vào tài khoản nào (RAW_MATERIAL TK152, TOOL TK153, MERCHANDISE TK156, FINISHED_GOOD TK155, CONSUMABLE_COMMON vật tư phụ phân bổ cuối kỳ). " +
  "Ràng buộc: SERVICE thì accountingClass phải trống; STOCK mặc định RAW_MATERIAL; PRODUCT mặc định FINISHED_GOOD.";

export const materialTools: McpTool[] = [
  {
    name: "list_materials",
    description:
      "Tìm kiếm/danh sách vật tư trong AHSO CRM. " +
      "Dùng khi: 'Tìm vật tư camera', 'Vật tư sắp hết hàng', 'Lấy ID vật tư để nhập kho'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khoá theo mã hoặc tên vật tư" },
        supplierId: { type: "string", description: "Lọc theo ID nhà cung cấp" },
        categoryId: { type: "string", description: "Lọc theo ID nhóm vật tư" },
        isActive: { type: "boolean", description: "Lọc vật tư đang dùng/ngưng" },
        lowStockOnly: { type: "boolean", description: "Chỉ lấy vật tư dưới tồn tối thiểu" },
        kind: { type: "string", enum: KIND_ENUM, description: "Tuỳ chọn. Lọc theo kind (có qua kho hay không): STOCK / SERVICE / PRODUCT" },
        accountingClass: { type: "string", enum: ACCOUNTING_CLASS_ENUM, description: "Tuỳ chọn. Lọc theo nhóm hạch toán tài khoản" },
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
      if (args["supplierId"]) params["supplierId"] = args["supplierId"];
      if (args["categoryId"]) params["categoryId"] = args["categoryId"];
      if (args["isActive"] !== undefined) params["isActive"] = args["isActive"];
      if (args["lowStockOnly"] !== undefined) params["lowStockOnly"] = args["lowStockOnly"];
      if (args["kind"]) params["kind"] = args["kind"];
      if (args["accountingClass"]) params["accountingClass"] = args["accountingClass"];

      const res = await client.get<unknown>("/materials", { params });
      const items = extractData<MaterialListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy vật tư nào.";

      const lines = items.map((material, index) => {
        const lowStock = material.isLowStock ? " ⚠️ dưới tồn min" : "";
        return (
          `${index + 1}. 📦 **${material.name}** (${material.code}) | ID: \`${material.id}\`\n` +
          `   ĐVT: ${material.unit} | Tồn: ${material.totalStock ?? 0}${lowStock} | Giá bán: ${formatVND(material.salePrice)}` +
          classSuffix(material)
        );
      });

      return `📦 **Vật tư** (${meta?.total ?? items.length} tổng):\n\n${lines.join("\n\n")}`;
    }
  },

  {
    name: "get_material_detail",
    description:
      "Xem chi tiết vật tư: tồn kho theo kho, nhà cung cấp, giá nhập/bán. " +
      "Dùng khi: 'Chi tiết vật tư [ID]', 'Vật tư camera còn ở kho nào?'.",
    inputSchema: {
      type: "object",
      properties: {
        materialId: { type: "string", description: "ID vật tư lấy từ list_materials" }
      },
      required: ["materialId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/materials/${args["materialId"] as string}`);
      const material = extractData<MaterialDetail>(res.data);

      let out = `📦 **${material.name}** (${material.code})\n`;
      out += `ID: \`${material.id}\` | ĐVT: ${material.unit} | Trạng thái: ${material.isActive ? "Hoạt động" : "Ngưng"}\n`;
      out += `Giá bán: ${formatVND(material.salePrice)} | Giá nhập TB: ${formatVND(material.costPrice)}`;
      if (material.minStock != null) out += ` | Tồn min: ${material.minStock}`;
      if (material.category?.name) out += `\nNhóm: ${material.category.name}`;
      if (material.kind) out += `\nKind: ${material.kind}${material.accountingClass ? ` | Hạch toán: ${ACCOUNTING_CLASS_LABEL[material.accountingClass] ?? material.accountingClass}` : " | Hạch toán: —"}`;
      if (material.description) out += `\n\n📝 ${truncate(material.description, 400)}`;

      if (material.stockBalances?.length) {
        out += `\n\n🏬 **Tồn kho:**\n`;
        out += material.stockBalances
          .map((balance) => `  • ${balance.warehouse?.name ?? "—"} | ID kho: \`${balance.warehouse?.id ?? balance.warehouseId}\` | ${balance.quantity} ${material.unit}`)
          .join("\n");
      }

      if (material.suppliers?.length) {
        out += `\n\n🏭 **Nhà cung cấp:**\n`;
        out += material.suppliers
          .map((supplier) => {
            const preferred = supplier.isPreferred ? " ⭐ ưu tiên" : "";
            return `  • ${supplier.supplier?.name ?? "—"} | ID: \`${supplier.supplier?.id ?? supplier.supplierId}\` | Giá: ${formatVND(supplier.costPrice)}${preferred}`;
          })
          .join("\n");
      }

      return out;
    }
  },

  {
    name: "create_material",
    description:
      "Tạo vật tư mới. Dùng khi user cung cấp mã, tên và đơn vị tính rõ ràng. " + KIND_HELP,
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Mã vật tư, bắt buộc" },
        name: { type: "string", description: "Tên vật tư, bắt buộc" },
        unit: { type: "string", description: "Đơn vị tính, bắt buộc" },
        kind: { type: "string", enum: KIND_ENUM, description: "Tuỳ chọn. Có qua kho hay không. Mặc định STOCK" },
        accountingClass: { type: "string", enum: ACCOUNTING_CLASS_ENUM, description: "Tuỳ chọn. Nhóm hạch toán tài khoản; bỏ trống = mặc định theo kind" },
        salePrice: { type: "number", description: "Giá bán VND" },
        costPrice: { type: "number", description: "Giá nhập VND" },
        minStock: { type: "number", description: "Tồn tối thiểu" },
        categoryId: { type: "string", description: "ID nhóm vật tư" },
        description: { type: "string", description: "Mô tả" },
        isActive: { type: "boolean", description: "Trạng thái hoạt động" },
        suppliers: {
          type: "array",
          description: "Danh sách nhà cung cấp cho vật tư",
          items: {
            type: "object",
            properties: {
              supplierId: { type: "string", description: "ID nhà cung cấp" },
              supplierCode: { type: "string", description: "Mã vật tư phía NCC" },
              costPrice: { type: "number", description: "Giá nhập từ NCC" },
              leadTimeDays: { type: "number", description: "Lead time ngày" },
              isPreferred: { type: "boolean", description: "NCC ưu tiên" }
            },
            required: ["supplierId"]
          }
        }
      },
      required: ["code", "name", "unit"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = buildMaterialPayload(args);
      const res = await client.post<unknown>("/materials", payload);
      const material = extractData<{ id: string; code: string; name: string }>(res.data);

      return `✅ Đã tạo vật tư **${material.name}** (${material.code})\nID: \`${material.id}\``;
    }
  },

  {
    name: "update_material",
    description:
      "Cập nhật vật tư hiện có. Dùng khi đã có materialId từ list_materials/get_material_detail. " + KIND_HELP + " Đổi kind sang SERVICE sẽ xóa accountingClass.",
    inputSchema: {
      type: "object",
      properties: {
        materialId: { type: "string", description: "ID vật tư" },
        code: { type: "string", description: "Mã vật tư" },
        name: { type: "string", description: "Tên vật tư" },
        unit: { type: "string", description: "Đơn vị tính" },
        kind: { type: "string", enum: KIND_ENUM, description: "Tuỳ chọn. Có qua kho hay không (STOCK/SERVICE/PRODUCT)" },
        accountingClass: { type: "string", enum: ACCOUNTING_CLASS_ENUM, description: "Tuỳ chọn. Nhóm hạch toán tài khoản" },
        salePrice: { type: "number", description: "Giá bán VND" },
        costPrice: { type: "number", description: "Giá nhập VND" },
        minStock: { type: "number", description: "Tồn tối thiểu" },
        categoryId: { type: "string", description: "ID nhóm vật tư" },
        description: { type: "string", description: "Mô tả" },
        isActive: { type: "boolean", description: "Trạng thái hoạt động" }
      },
      required: ["materialId"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = buildMaterialPayload(args);
      const res = await client.patch<unknown>(`/materials/${args["materialId"] as string}`, payload);
      const material = extractData<{ id: string; code: string; name: string }>(res.data);

      return `✅ Đã cập nhật vật tư **${material.name}** (${material.code})\nID: \`${material.id}\``;
    }
  },

  {
    name: "bulk_update_material_classes",
    description:
      "Cập nhật nhóm hạch toán (accountingClass) hàng loạt cho vật tư — dành cho kế toán chỉnh lại phân loại. " +
      "Mỗi dòng xử lý độc lập; dòng vi phạm ràng buộc kind (VD vật tư SERVICE mà gán RAW_MATERIAL) báo lỗi riêng, các dòng khác vẫn chạy. Tối đa 500 dòng. " + KIND_HELP,
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Danh sách vật tư cần đổi nhóm hạch toán",
          items: {
            type: "object",
            properties: {
              materialId: { type: "string", description: "ID vật tư" },
              accountingClass: { type: "string", enum: ACCOUNTING_CLASS_ENUM, description: "Nhóm hạch toán mới" }
            },
            required: ["materialId", "accountingClass"]
          }
        }
      },
      required: ["items"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.patch<unknown>("/materials/bulk-classes", { items: args["items"] ?? [] });
      const out = extractData<BulkClassResult>(res.data);

      const ICON: Record<string, string> = { UPDATED: "✅", UNCHANGED: "➖", NOT_FOUND: "❓", ERROR: "❌" };
      const lines = out.results.map(
        (row) => `${ICON[row.status] ?? "•"} #${row.index + 1} ${row.code ?? `\`${row.materialId}\``}: ${row.message}` + (row.status === "UPDATED" ? ` (${row.from ?? "—"} → ${row.to ?? "—"})` : "")
      );
      const sum = out.summary;
      return `📦 **Kết quả đổi nhóm hạch toán:** ${sum.updated}/${sum.total} cập nhật, ${sum.unchanged} không đổi, ${sum.notFound} không tìm thấy, ${sum.error} lỗi\n\n${lines.join("\n")}`;
    }
  },

  {
    name: "set_material_suppliers",
    description:
      "Thay thế danh sách nhà cung cấp của một vật tư. Lưu ý: thao tác này ghi đè toàn bộ danh sách NCC hiện tại của vật tư.",
    inputSchema: {
      type: "object",
      properties: {
        materialId: { type: "string", description: "ID vật tư" },
        suppliers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              supplierId: { type: "string", description: "ID nhà cung cấp" },
              supplierCode: { type: "string", description: "Mã vật tư phía NCC" },
              costPrice: { type: "number", description: "Giá nhập từ NCC" },
              leadTimeDays: { type: "number", description: "Lead time ngày" },
              isPreferred: { type: "boolean", description: "NCC ưu tiên" }
            },
            required: ["supplierId"]
          }
        }
      },
      required: ["materialId", "suppliers"]
    },
    async handler(args) {
      const client = getApiClient();
      const suppliers = (args["suppliers"] as unknown[]) ?? [];
      const res = await client.put<unknown>(`/materials/${args["materialId"] as string}/suppliers`, suppliers);
      const result = extractData<{ id: string; supplierCount: number }>(res.data);

      return `✅ Đã cập nhật ${result.supplierCount} nhà cung cấp cho vật tư ID: \`${result.id}\``;
    }
  },

  {
    name: "delete_material",
    description:
      "Xoá mềm vật tư theo ID. Chỉ dùng khi user yêu cầu xoá rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        materialId: { type: "string", description: "ID vật tư cần xoá" }
      },
      required: ["materialId"]
    },
    async handler(args) {
      const client = getApiClient();
      const materialId = args["materialId"] as string;
      await client.delete<unknown>(`/materials/${materialId}`);

      return `✅ Đã xoá vật tư ID: \`${materialId}\``;
    }
  }
];

function classSuffix(material: { kind?: string; accountingClass?: string | null }): string {
  if (!material.kind) return "";
  return `\n   Kind: ${material.kind} | Hạch toán: ${material.accountingClass ? (ACCOUNTING_CLASS_LABEL[material.accountingClass] ?? material.accountingClass) : "—"}`;
}

function buildMaterialPayload(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  const fields = [
    "code",
    "name",
    "unit",
    "kind",
    "accountingClass",
    "salePrice",
    "costPrice",
    "minStock",
    "categoryId",
    "description",
    "isActive",
    "suppliers"
  ];
  for (const field of fields) {
    if (args[field] !== undefined && args[field] !== null) {
      payload[field] = args[field];
    }
  }
  return payload;
}

interface MaterialListItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  kind?: string;
  accountingClass?: string | null;
  minStock?: number | null;
  totalStock?: number;
  isLowStock?: boolean;
}

interface MaterialDetail extends MaterialListItem {
  category?: { id: string; name: string } | null;
  description?: string | null;
  isActive: boolean;
  suppliers?: Array<{
    supplierId: string;
    costPrice: number;
    isPreferred?: boolean;
    supplier?: { id: string; code: string; name: string } | null;
  }>;
  stockBalances?: Array<{
    warehouseId: string;
    quantity: number;
    warehouse?: { id: string; name: string } | null;
  }>;
}

interface BulkClassResult {
  results: Array<{
    index: number;
    materialId: string;
    code?: string;
    status: string;
    message: string;
    from?: string | null;
    to?: string | null;
  }>;
  summary: { total: number; updated: number; unchanged: number; notFound: number; error: number };
}
