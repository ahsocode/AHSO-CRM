import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatVND, formatDate, truncate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "📝 Bản nháp",
  SENT: "📤 Đã gửi",
  ACCEPTED: "✅ Chấp nhận",
  REJECTED: "❌ Từ chối",
  EXPIRED: "⏰ Hết hạn",
};

export const quoteTools: McpTool[] = [
  {
    name: "list_quotes",
    description:
      "Danh sách báo giá theo trạng thái hoặc khách hàng. " +
      "Dùng khi: 'Báo giá nào đang chờ phản hồi?', 'Báo giá của dự án X?'",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
          description: "Lọc theo trạng thái (tuỳ chọn)",
        },
        customerId: { type: "string", description: "ID khách hàng (tuỳ chọn)" },
        projectId: { type: "string", description: "ID dự án (tuỳ chọn)" },
        limit: { type: "number", description: "Số kết quả tối đa (mặc định 10)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        limit: args["limit"] ?? 10,
        page: 1,
      };
      if (args["status"]) params["status"] = args["status"];
      if (args["customerId"]) params["customerId"] = args["customerId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];

      const res = await client.get<unknown>("/quotes", { params });
      const items = extractData<QuoteListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy báo giá nào.";

      const lines = items.map((q) => {
        const status = QUOTE_STATUS_LABEL[q.status ?? ""] ?? q.status ?? "—";
        return (
          `  • **${q.quoteNo}** ${status}\n` +
          `    KH: ${q.project?.customer?.name ?? "—"} | ${formatVND(q.totalAmount)} | ${formatDate(q.createdAt)}`
        );
      });

      return (
        `📄 **Báo giá** (${meta?.total ?? items.length} tổng):\n\n` +
        lines.join("\n")
      );
    },
  },

  {
    name: "get_quote_detail",
    description:
      "Xem chi tiết một báo giá: hạng mục, tổng tiền, trạng thái. " +
      "Dùng khi: 'Chi tiết báo giá BG-2026-001', 'Báo giá X có những gì?'",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá (lấy từ list_quotes)" },
      },
      required: ["quoteId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/quotes/${args["quoteId"] as string}`);
      const q = extractData<QuoteDetail>(res.data);

      const status = QUOTE_STATUS_LABEL[q.status ?? ""] ?? q.status ?? "—";
      let out = `📄 **Báo giá ${q.quoteNo}** — ${status}\n`;
      out += `🏢 Khách hàng: ${q.project?.customer?.name ?? "—"}\n`;
      if (q.project?.name) out += `📁 Dự án: ${q.project.name}\n`;
      out += `📅 Ngày tạo: ${formatDate(q.createdAt)}`;
      if (q.sentAt) out += ` | Đã gửi: ${formatDate(q.sentAt)}`;
      out += `\n💰 **Tổng tiền: ${formatVND(q.totalAmount)}**`;
      if (q.vatRate) out += ` (VAT ${q.vatRate}%)`;
      out += "\n";

      if (q.items?.length) {
        out += `\n📋 **Hạng mục (${q.items.length} dòng):**\n`;
        out += q.items
          .slice(0, 10)
          .map(
            (item, i) =>
              `  ${i + 1}. ${item.name} — ${item.qty} ${item.unit ?? ""} × ${formatVND(item.unitPrice)} = ${formatVND(item.total)}`
          )
          .join("\n");
        if (q.items.length > 10) out += `\n  ... và ${q.items.length - 10} dòng khác`;
      }

      if (q.notes) out += `\n\n📝 Ghi chú: ${truncate(q.notes)}`;

      return out;
    },
  },

  {
    name: "add_quote_items",
    description:
      "Thêm hoặc thay thế danh sách hạng mục trong báo giá (chỉ DRAFT). " +
      "Dùng khi: 'Thêm 3 thiết bị vào BG-2026-012', 'Cập nhật hạng mục báo giá AHSO-331'. " +
      "Lưu ý: thao tác này THAY THẾ toàn bộ items — hãy liệt kê đủ tất cả hạng mục muốn giữ lại.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá (phải ở trạng thái DRAFT)" },
        items: {
          type: "array",
          description: "Danh sách hạng mục (tối đa 50)",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Tên hạng mục (bắt buộc)" },
              quantity: { type: "number", description: "Số lượng (bắt buộc, > 0)" },
              unitPrice: { type: "number", description: "Đơn giá VND (bắt buộc, >= 0)" },
              unit: { type: "string", description: "Đơn vị: cái, bộ, m, kg... (tuỳ chọn)" },
              description: { type: "string", description: "Mô tả chi tiết (tuỳ chọn)" },
            },
            required: ["name", "quantity", "unitPrice"],
          },
        },
      },
      required: ["quoteId", "items"],
    },
    async handler(args) {
      const client = getApiClient();
      const quoteId = args["quoteId"] as string;

      // Lấy projectId và validate trạng thái DRAFT
      const quoteRes = await client.get<unknown>(`/quotes/${quoteId}`);
      const quote = extractData<QuoteDetail>(quoteRes.data);

      if (quote.status && !["DRAFT", "REJECTED"].includes(quote.status)) {
        return `❌ Báo giá **${quote.quoteNo}** đang ở trạng thái "${quote.status}" — chỉ có thể sửa khi DRAFT hoặc bị từ chối.`;
      }

      const projectId = quote.project?.id;
      if (!projectId) {
        return `❌ Không lấy được projectId từ báo giá ${quoteId}.`;
      }

      const items = args["items"] as Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        unit?: string;
        description?: string;
      }>;

      if (!items?.length) {
        return `❌ Phải có ít nhất 1 hạng mục.`;
      }

      await client.patch<unknown>(`/quotes/${quoteId}`, { projectId, items });

      // Đọc lại để hiển thị kết quả
      const updatedRes = await client.get<unknown>(`/quotes/${quoteId}`);
      const updated = extractData<QuoteDetail>(updatedRes.data);
      const updatedItems = updated.items ?? [];

      let out = `✅ Đã cập nhật báo giá **${updated.quoteNo}** — ${updatedItems.length} hạng mục:\n\n`;
      updatedItems.forEach((item, i) => {
        out += `  ${i + 1}. ${item.name}`;
        if (item.quantity && item.unitPrice) {
          out += ` — ${item.quantity} ${item.unit ?? ""} × ${formatVND(item.unitPrice)} = **${formatVND(item.total)}**`;
        }
        out += "\n";
      });
      if (updated.total) out += `\n💰 **Tổng: ${formatVND(updated.total)}**`;

      return out;
    },
  },

  {
    name: "update_quote_status",
    description:
      "Cập nhật trạng thái báo giá (đã gửi, khách chấp nhận, từ chối). " +
      "Dùng khi: 'Đánh dấu BG-2026-012 đã gửi cho KH', 'KH Sabeco từ chối báo giá BG-2026-008'.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá" },
        status: {
          type: "string",
          enum: ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
          description: "Trạng thái mới",
        },
        notes: { type: "string", description: "Lý do từ chối, ghi chú khi gửi..." },
      },
      required: ["quoteId", "status"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = { status: args["status"] };
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.patch<unknown>(`/quotes/${args["quoteId"] as string}/status`, payload);
      const q = extractData<{ quoteNo: string; status: string }>(res.data);
      const statusMap: Record<string, string> = {
        SENT: "📤 Đã gửi",
        ACCEPTED: "✅ KH chấp nhận",
        REJECTED: "❌ KH từ chối",
        EXPIRED: "⏰ Hết hạn",
      };

      const status = statusMap[q.status] ?? q.status;
      return `✅ Báo giá ${q.quoteNo} → ${status}`;
    },
  },

  {
    name: "duplicate_quote",
    description:
      "Nhân bản một báo giá hiện có. " +
      "Dùng khi: 'Nhân bản BG-2026-008 để làm phiên bản v2', 'Copy báo giá cũ cho dự án mới'.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá cần nhân bản" },
        projectId: { type: "string", description: "ID dự án (nếu muốn nhân bản sang dự án khác)" },
      },
      required: ["quoteId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      if (args["projectId"]) payload["projectId"] = args["projectId"];

      const res = await client.post<unknown>(`/quotes/${args["quoteId"] as string}/duplicate`, payload);
      const q = extractData<{ id: string; quoteNo: string }>(res.data);

      return `✅ Đã nhân bản → ${q.quoteNo} [Bản nháp] | ID: ${q.id}`;
    },
  },
];

// Interfaces

interface QuoteListItem {
  id: string;
  quoteNo: string;
  status?: string;
  totalAmount?: number | string;
  createdAt?: string;
  project?: { name?: string; customer?: { name: string } };
}

interface QuoteDetail {
  id: string;
  quoteNo: string;
  status?: string;
  total?: number | string;
  totalAmount?: number | string;
  vatRate?: number;
  createdAt?: string;
  sentAt?: string;
  notes?: string;
  project?: { id: string; name: string; customer?: { name: string } };
  items?: Array<{
    name: string;
    quantity?: number;
    qty?: number;
    unit?: string;
    unitPrice: number | string;
    total: number | string;
  }>;
}
