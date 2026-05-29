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
  totalAmount?: number | string;
  vatRate?: number;
  createdAt?: string;
  sentAt?: string;
  notes?: string;
  project?: { name: string; customer?: { name: string } };
  items?: Array<{
    name: string;
    qty: number;
    unit?: string;
    unitPrice: number | string;
    total: number | string;
  }>;
}
