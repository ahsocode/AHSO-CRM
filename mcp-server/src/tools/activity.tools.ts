import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import {
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
