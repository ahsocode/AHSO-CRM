import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import {
  formatVND,
  formatVNDShort,
  formatDate,
  stageLabel,
  truncate,
} from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const STAGE_EMOJI: Record<string, string> = {
  SURVEY: "🔍",
  QUOTING: "📄",
  NEGOTIATING: "🤝",
  DELIVERING: "🚚",
  COMPLETED: "✅",
  LOST: "❌",
};

export const pipelineTools: McpTool[] = [
  {
    name: "get_pipeline_overview",
    description:
      "Xem tổng quan pipeline (danh sách dự án đang triển khai theo giai đoạn). " +
      "Dùng khi: 'Pipeline hiện tại thế nào?', 'Các deal đang đàm phán?'",
    inputSchema: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: ["SURVEY", "QUOTING", "NEGOTIATING", "DELIVERING", "COMPLETED", "LOST"],
          description: "Lọc theo giai đoạn (tuỳ chọn)",
        },
        assignedTo: { type: "string", description: "ID hoặc tên nhân viên phụ trách (tuỳ chọn)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = { limit: 30, page: 1 };
      if (args["stage"]) params["status"] = args["stage"];
      if (args["assignedTo"]) params["assignedTo"] = args["assignedTo"];

      const res = await client.get<unknown>("/projects", { params });
      const items = extractData<ProjectListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) {
        return args["stage"]
          ? `📭 Không có dự án nào ở giai đoạn ${stageLabel(args["stage"] as string)}.`
          : "📭 Pipeline đang trống.";
      }

      // Nhóm theo stage
      const grouped = new Map<string, ProjectListItem[]>();
      for (const p of items) {
        const stage = p.status ?? "UNKNOWN";
        if (!grouped.has(stage)) grouped.set(stage, []);
        grouped.get(stage)!.push(p);
      }

      const stageOrder = ["SURVEY", "QUOTING", "NEGOTIATING", "DELIVERING", "COMPLETED", "LOST"];
      const sections: string[] = [];

      for (const stage of stageOrder) {
        const stageItems = grouped.get(stage);
        if (!stageItems) continue;
        const emoji = STAGE_EMOJI[stage] ?? "📌";
        const totalValue = stageItems.reduce((s, p) => s + (Number(p.estimatedValue) || 0), 0);
        sections.push(
          `${emoji} **${stageLabel(stage)}** (${stageItems.length} deal — ${formatVNDShort(totalValue)}):\n` +
            stageItems
              .map(
                (p) =>
                  `  • ${p.code} — ${p.name}${p.customer ? ` [${p.customer.name}]` : ""}` +
                  (p.estimatedValue ? ` — ${formatVNDShort(Number(p.estimatedValue))}` : "")
              )
              .join("\n")
        );
      }

      const total = meta?.total ?? items.length;
      const header = `📊 Pipeline: ${total} dự án\n\n`;
      return header + sections.join("\n\n");
    },
  },

  {
    name: "get_project_detail",
    description:
      "Xem chi tiết một dự án: tiến độ, báo giá, hợp đồng, hoạt động gần đây. " +
      "Dùng khi: 'Dự án Thaco Auto đang đến đâu?', 'Cập nhật tình trạng deal [mã dự án]'.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID dự án (lấy từ get_pipeline_overview)" },
      },
      required: ["projectId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/projects/${args["projectId"] as string}`);
      const p = extractData<ProjectDetail>(res.data);

      const emoji = STAGE_EMOJI[p.status ?? ""] ?? "📌";
      let out = `${emoji} **${p.name}** (${p.code})\n`;
      out += `Giai đoạn: ${stageLabel(p.status)} | Khách hàng: ${p.customer?.name ?? "—"}\n`;
      if (p.estimatedValue) out += `💰 Giá trị ước tính: ${formatVND(p.estimatedValue)}\n`;
      if (p.assignedTo) out += `👤 Phụ trách: ${p.assignedTo.name ?? p.assignedTo.email}\n`;
      if (p.description) out += `\n📝 Mô tả: ${truncate(p.description)}\n`;

      if (p.quotes?.length) {
        out += `\n📄 **Báo giá:**\n`;
        out += p.quotes
          .slice(0, 3)
          .map(
            (q) =>
              `  • ${q.quoteNo} [${q.status}] — ${formatVND(q.totalAmount)} — ${formatDate(q.createdAt)}`
          )
          .join("\n");
      }

      if (p.contracts?.length) {
        out += `\n\n📃 **Hợp đồng:**\n`;
        out += p.contracts
          .slice(0, 2)
          .map(
            (c) =>
              `  • ${c.contractNo} [${c.status}] — ${formatVND(c.value)} — Ký: ${formatDate(c.signedAt)}`
          )
          .join("\n");
      }

      if (p.activities?.length) {
        out += `\n\n📋 **Hoạt động gần đây:**\n`;
        out += p.activities
          .slice(0, 3)
          .map((a) => `  • ${a.title} — ${formatDate(a.createdAt)}`)
          .join("\n");
      }

      return out;
    },
  },

  {
    name: "create_project",
    description:
      "Tạo deal/dự án mới trong pipeline. " +
      "Dùng khi: 'Tạo deal mới cho Sabeco, giai đoạn Khảo sát, 2 tỷ'.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tên dự án" },
        customerId: { type: "string", description: "ID khách hàng (lấy từ search_customers)" },
        stage: {
          type: "string",
          enum: ["SURVEY", "QUOTING", "NEGOTIATING", "DELIVERING"],
          description: "Giai đoạn ban đầu (mặc định: SURVEY)",
        },
        estimatedValue: { type: "number", description: "Giá trị ước tính (VND)" },
        description: { type: "string", description: "Mô tả ngắn về dự án" },
        assignedTo: { type: "string", description: "ID nhân viên phụ trách (tuỳ chọn)" },
      },
      required: ["name", "customerId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        name: args["name"],
        customerId: args["customerId"],
        status: (args["stage"] as string) ?? "SURVEY",
      };
      if (args["estimatedValue"]) payload["estimatedValue"] = args["estimatedValue"];
      if (args["description"]) payload["description"] = args["description"];
      if (args["assignedTo"]) payload["assignedToId"] = args["assignedTo"];

      const res = await client.post<unknown>("/projects", payload);
      const p = extractData<{ id: string; code: string; name: string; status: string }>(res.data);

      return (
        `✅ Đã tạo deal mới:\n` +
        `${STAGE_EMOJI[p.status] ?? "📌"} **${p.name}** (${p.code})\n` +
        `Giai đoạn: ${stageLabel(p.status)}\n` +
        `ID: ${p.id}\n\n` +
        `💡 Dùng update_project_stage để chuyển giai đoạn khi có tiến triển.`
      );
    },
  },

  {
    name: "update_project_stage",
    description:
      "Chuyển giai đoạn của một dự án trong pipeline. " +
      "Dùng khi: 'Chuyển deal Hòa Phát sang Đàm phán', 'Đánh dấu dự án X đã thua'.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID dự án" },
        stage: {
          type: "string",
          enum: ["SURVEY", "QUOTING", "NEGOTIATING", "DELIVERING", "COMPLETED", "LOST"],
          description: "Giai đoạn mới",
        },
      },
      required: ["projectId", "stage"],
    },
    async handler(args) {
      const client = getApiClient();
      const id = args["projectId"] as string;
      const newStage = args["stage"] as string;

      const res = await client.patch<unknown>(`/projects/${id}/status`, {
        status: newStage,
      });
      const p = extractData<{ code: string; name: string; status: string }>(res.data);

      const emoji = STAGE_EMOJI[p.status] ?? "📌";
      return (
        `✅ Đã cập nhật giai đoạn:\n` +
        `${emoji} **${p.name}** (${p.code})\n` +
        `Giai đoạn mới: **${stageLabel(p.status)}**`
      );
    },
  },
];

// Interfaces

interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  status?: string;
  estimatedValue?: number | string;
  customer?: { name: string };
}

interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  status?: string;
  estimatedValue?: number | string;
  description?: string;
  customer?: { name: string };
  assignedTo?: { name?: string; email: string };
  quotes?: Array<{ quoteNo: string; status: string; totalAmount?: number; createdAt: string }>;
  contracts?: Array<{ contractNo: string; status: string; value?: number; signedAt?: string }>;
  activities?: Array<{ title: string; createdAt: string }>;
}
