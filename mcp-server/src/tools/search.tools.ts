import { getApiClient, extractData } from "../auth/api-client.js";
import { formatVND, stageLabel, truncate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

export const searchTools: McpTool[] = [
  {
    name: "search_global",
    description:
      "Tìm kiếm toàn hệ thống: khách hàng, dự án, báo giá, hợp đồng, hoạt động cùng lúc. " +
      "Dùng khi: 'Tìm Mondelez', 'AHSO-307 là gì?', 'BG-2026-001'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khoá tìm kiếm" },
        limit: { type: "number", description: "Số kết quả mỗi loại (mặc định 5)" },
      },
      required: ["query"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>("/search/global", {
        params: { q: args["query"], limit: args["limit"] ?? 5 },
      });
      const data = extractData<SearchResult>(res.data);

      const sections: string[] = [];

      if (data.customers?.length) {
        sections.push(
          `🏢 **Khách hàng (${data.customers.length}):**\n` +
            data.customers
              .map((c) => `  • ${c.name}${c.shortName ? ` (${c.shortName})` : ""} — ID: ${c.id}`)
              .join("\n")
        );
      }
      if (data.projects?.length) {
        sections.push(
          `📁 **Dự án (${data.projects.length}):**\n` +
            data.projects
              .map(
                (p) =>
                  `  • ${p.code} — ${p.name}` +
                  (p.status ? ` [${stageLabel(p.status)}]` : "") +
                  (p.estimatedValue ? ` — ${formatVND(p.estimatedValue)}` : "")
              )
              .join("\n")
        );
      }
      if (data.quotes?.length) {
        sections.push(
          `📄 **Báo giá (${data.quotes.length}):**\n` +
            data.quotes
              .map(
                (q) =>
                  `  • ${q.quoteNo} [${q.status ?? "—"}]` +
                  (q.totalAmount ? ` — ${formatVND(q.totalAmount)}` : "")
              )
              .join("\n")
        );
      }
      if (data.contracts?.length) {
        sections.push(
          `📃 **Hợp đồng (${data.contracts.length}):**\n` +
            data.contracts
              .map(
                (c) =>
                  `  • ${c.contractNo} [${c.status ?? "—"}]` +
                  (c.value ? ` — ${formatVND(c.value)}` : "")
              )
              .join("\n")
        );
      }
      if (data.activities?.length) {
        sections.push(
          `📋 **Hoạt động (${data.activities.length}):**\n` +
            data.activities.map((a) => `  • ${a.title} — ${truncate(a.content, 60)}`).join("\n")
        );
      }

      if (!sections.length) {
        return `🔍 Không tìm thấy kết quả nào cho "${args["query"] as string}".`;
      }

      return `🔍 Kết quả tìm kiếm "${args["query"] as string}":\n\n` + sections.join("\n\n");
    },
  },

  {
    name: "get_dashboard_kpi",
    description:
      "KPI tổng quan: doanh thu tháng, pipeline, báo giá chờ, hợp đồng active. " +
      "Dùng khi: 'Tóm tắt tình hình kinh doanh', 'Dashboard hôm nay'.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    async handler() {
      const client = getApiClient();
      const res = await client.get<unknown>("/dashboard");
      const data = extractData<DashboardKpi>(res.data);

      let out = `📊 **Dashboard AHSO CRM:**\n\n`;

      if (data.revenue != null) {
        const growth = data.revenueGrowth;
        const growthText =
          growth != null
            ? growth >= 0
              ? ` ↑ +${growth.toFixed(1)}%`
              : ` ↓ ${growth.toFixed(1)}%`
            : "";
        out += `💰 Doanh thu tháng này: **${formatVND(data.revenue)}**${growthText}\n`;
      }
      if (data.activeProjects != null) {
        out += `📁 Dự án đang chạy: **${data.activeProjects}**\n`;
      }
      if (data.pendingQuotesValue != null) {
        out += `📄 Báo giá chờ phản hồi: **${formatVND(data.pendingQuotesValue)}**`;
        if (data.pendingQuotesCount != null) out += ` (${data.pendingQuotesCount} BG)`;
        out += "\n";
      }
      if (data.activeContractsValue != null) {
        out += `📃 Hợp đồng đang hiệu lực: **${formatVND(data.activeContractsValue)}**\n`;
      }
      if (data.overdueTasksCount != null && data.overdueTasksCount > 0) {
        out += `⚠️ Task quá hạn: **${data.overdueTasksCount}**\n`;
      }

      if (data.pipeline?.length) {
        out += `\n📈 Pipeline:\n`;
        out += data.pipeline
          .map((s) => `  ${stageLabel(s.status)}: ${s.count} deal — ${formatVND(s.value)}`)
          .join("\n");
      }

      return out;
    },
  },

  {
    name: "create_quote",
    description:
      "Tạo báo giá mới cho một dự án. " +
      "Dùng khi: 'Tạo báo giá cho dự án Mondelez', 'Lập báo giá AHSO-307'.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID dự án (lấy từ search_global hoặc get_pipeline_overview)" },
        title: { type: "string", description: "Tiêu đề báo giá" },
        validDays: { type: "number", description: "Hiệu lực (ngày, mặc định 30)" },
        notes: { type: "string", description: "Ghi chú thêm (tuỳ chọn)" },
        itemName: { type: "string", description: "Tên hạng mục đầu tiên (tuỳ chọn, mặc định 'Hạng mục báo giá')" },
        itemPrice: { type: "number", description: "Đơn giá hạng mục đầu tiên (tuỳ chọn)" },
      },
      required: ["projectId"],
    },
    async handler(args) {
      const client = getApiClient();

      // Lấy thông tin project trước
      const projRes = await client.get<unknown>(`/projects/${args["projectId"] as string}`);
      const project = extractData<{ code: string; name: string; customer?: { name: string } }>(
        projRes.data
      );

      const validDays = (args["validDays"] as number) ?? 30;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);

      // Backend yêu cầu ít nhất 1 hạng mục — tạo placeholder nếu không có
      const firstItem = {
        name: (args["itemName"] as string) || "Hạng mục báo giá",
        quantity: 1,
        unitPrice: (args["itemPrice"] as number) ?? 0,
      };

      const payload: Record<string, unknown> = {
        projectId: args["projectId"],
        validUntil: validUntil.toISOString(),
        status: "DRAFT",
        taxRate: 10,
        items: [firstItem],
      };
      if (args["notes"]) payload["internalNote"] = args["notes"];

      const res = await client.post<unknown>("/quotes", payload);
      const q = extractData<{ id: string; quoteNo: string; status: string }>(res.data);

      return (
        `✅ Đã tạo báo giá:\n` +
        `📄 **${q.quoteNo}** [Bản nháp]\n` +
        `📁 Dự án: ${project.code} — ${project.name}\n` +
        `🏢 KH: ${project.customer?.name ?? "—"}\n` +
        `⏳ Hiệu lực: ${validDays} ngày\n\n` +
        `💡 Mở CRM để thêm hạng mục và gửi báo giá.`
      );
    },
  },
];

// Interfaces

interface SearchResult {
  customers?: Array<{ id: string; name: string; shortName?: string }>;
  projects?: Array<{ id: string; code: string; name: string; status?: string; estimatedValue?: number | string }>;
  quotes?: Array<{ id: string; quoteNo: string; status?: string; totalAmount?: number | string }>;
  contracts?: Array<{ id: string; contractNo: string; status?: string; value?: number | string }>;
  activities?: Array<{ id: string; title: string; content?: string }>;
}

interface DashboardKpi {
  revenue?: number;
  revenueGrowth?: number;
  activeProjects?: number;
  pendingQuotesValue?: number;
  pendingQuotesCount?: number;
  activeContractsValue?: number;
  overdueTasksCount?: number;
  pipeline?: Array<{ status: string; count: number; value: number }>;
}
