import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatVND, truncate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

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

      const res = await client.get<unknown>("/materials", { params });
      const items = extractData<MaterialListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy vật tư nào.";

      const lines = items.map((material, index) => {
        const lowStock = material.isLowStock ? " ⚠️ dưới tồn min" : "";
        return (
          `${index + 1}. 📦 **${material.name}** (${material.code}) | ID: \`${material.id}\`\n` +
          `   ĐVT: ${material.unit} | Tồn: ${material.totalStock ?? 0}${lowStock} | Giá bán: ${formatVND(material.salePrice)}`
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
      "Tạo vật tư mới. Dùng khi user cung cấp mã, tên và đơn vị tính rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Mã vật tư, bắt buộc" },
        name: { type: "string", description: "Tên vật tư, bắt buộc" },
        unit: { type: "string", description: "Đơn vị tính, bắt buộc" },
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
      "Cập nhật vật tư hiện có. Dùng khi đã có materialId từ list_materials/get_material_detail.",
    inputSchema: {
      type: "object",
      properties: {
        materialId: { type: "string", description: "ID vật tư" },
        code: { type: "string", description: "Mã vật tư" },
        name: { type: "string", description: "Tên vật tư" },
        unit: { type: "string", description: "Đơn vị tính" },
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

function buildMaterialPayload(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  const fields = [
    "code",
    "name",
    "unit",
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
