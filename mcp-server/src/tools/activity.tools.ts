import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import {
  formatDate,
  formatDateTime,
  activityTypeLabel,
  truncate,
} from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

export const activityTools: McpTool[] = [
  {
    name: "list_activities",
    description:
      "Xem lịch sử hoạt động với khách hàng hoặc dự án. " +
      "Dùng khi: 'Lịch sử liên hệ với Sabeco?', 'Các cuộc gọi tuần này?'",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID khách hàng (tuỳ chọn)" },
        projectId: { type: "string", description: "ID dự án (tuỳ chọn)" },
        type: {
          type: "string",
          enum: ["CALL", "MEETING", "EMAIL", "NOTE", "SURVEY", "DEMO", "FOLLOWUP"],
          description: "Loại hoạt động (tuỳ chọn)",
        },
        limit: { type: "number", description: "Số kết quả (mặc định 10)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        limit: args["limit"] ?? 10,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      if (args["customerId"]) params["customerId"] = args["customerId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];
      if (args["type"]) params["type"] = args["type"];

      const res = await client.get<unknown>("/activities", { params });
      const items = extractData<ActivityItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không có hoạt động nào.";

      const lines = items.map(
        (a) =>
          `• ${activityTypeLabel(a.type)} **${a.title}**\n` +
          `  ${formatDateTime(a.createdAt)}` +
          (a.customer ? ` | 🏢 ${a.customer.name}` : "") +
          (a.content ? `\n  📝 ${truncate(a.content, 80)}` : "")
      );

      return (
        `📋 **Hoạt động** (${meta?.total ?? items.length} tổng):\n\n` +
        lines.join("\n\n")
      );
    },
  },

  {
    name: "log_activity",
    description:
      "Ghi nhận một hoạt động hoặc tương tác với khách hàng. Hỗ trợ nhiều loại hoạt động hơn add_activity_note (như SURVEY, DEMO, FOLLOWUP) và có thể gắn với dự án, thời lượng. " +
      "Dùng khi: 'Ghi demo sản phẩm cho dự án AHSO-307, 2 tiếng', 'Log cuộc họp khảo sát với Sabeco'.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["CALL", "MEETING", "EMAIL", "NOTE", "SURVEY", "DEMO", "FOLLOWUP"],
          description: "Loại hoạt động",
        },
        title: { type: "string", description: "Tiêu đề hoạt động" },
        content: { type: "string", description: "Nội dung chi tiết" },
        customerId: { type: "string", description: "ID khách hàng" },
        projectId: { type: "string", description: "ID dự án" },
        scheduledAt: { type: "string", description: "Thời gian diễn ra (ISO datetime)" },
        durationMinutes: { type: "number", description: "Thời lượng (phút)" },
      },
      required: ["type", "title"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        type: args["type"],
        title: args["title"],
      };
      if (args["content"]) payload["content"] = args["content"];
      if (args["customerId"]) payload["customerId"] = args["customerId"];
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["scheduledAt"]) payload["scheduledAt"] = args["scheduledAt"];
      if (args["durationMinutes"]) payload["durationMinutes"] = args["durationMinutes"];

      const res = await client.post<unknown>("/activities", payload);
      const a = extractData<{ id: string; type: string; title: string; createdAt: string }>(res.data);

      return `✅ Đã ghi ${activityTypeLabel(a.type)}: "${a.title}" — ${formatDate(a.createdAt)}`;
    },
  },

  {
    name: "get_activity_detail",
    description:
      "Xem chi tiết đầy đủ một hoạt động ghi chú. " +
      "Dùng khi: 'Xem nội dung đầy đủ activity [ID]'.",
    inputSchema: {
      type: "object",
      properties: {
        activityId: { type: "string", description: "ID hoạt động" },
      },
      required: ["activityId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/activities/${args["activityId"] as string}`);
      const a = extractData<ActivityItem & { createdBy?: { name?: string; email?: string } }>(res.data);

      let out = `${activityTypeLabel(a.type)} **${a.title}**\n`;
      out += `📅 Ngày tạo: ${formatDateTime(a.createdAt)}\n`;
      if (a.customer) out += `🏢 Khách hàng: ${a.customer.name}\n`;
      if (a.project) out += `📁 Dự án: ${a.project.name}\n`;
      if (a.createdBy) out += `👤 Người tạo: ${a.createdBy.name ?? a.createdBy.email ?? "—"}\n`;
      out += `\n📝 Nội dung:\n${a.content ?? "—"}`;

      return out;
    },
  },
];

interface ActivityItem {
  id: string;
  type?: string;
  title: string;
  content?: string;
  createdAt: string;
  customer?: { name: string };
  project?: { name: string };
}
