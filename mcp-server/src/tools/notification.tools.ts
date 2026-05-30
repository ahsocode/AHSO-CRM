import { getApiClient, extractData } from "../auth/api-client.js";
import { formatRelative } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

export const notificationTools: McpTool[] = [
  {
    name: "get_notifications",
    description:
      "Lấy danh sách thông báo. " +
      "Dùng khi: 'Có thông báo gì không?', 'Tin nhắn mới hôm nay'.",
    inputSchema: {
      type: "object",
      properties: {
        unreadOnly: { type: "boolean", description: "Chỉ lấy thông báo chưa đọc (mặc định true)" },
        limit: { type: "number", description: "Số kết quả tối đa (mặc định 15)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        limit: args["limit"] ?? 15,
        unreadOnly: args["unreadOnly"] ?? true,
      };

      const res = await client.get<unknown>("/notifications", { params });
      const items = extractData<NotificationItem[]>(res.data);

      if (!items.length) {
        return "✅ Không có thông báo mới.";
      }

      const count = items.length;
      let out = `🔔 ${count} thông báo chưa đọc:\n\n`;

      for (const item of items) {
        let icon = "•";
        if (item.type === "INFO") icon = "ℹ️";
        if (item.type === "WARNING") icon = "⚠️";
        if (item.type === "SUCCESS") icon = "✅";
        if (item.type === "ERROR") icon = "❌";

        out += `${icon} **${item.title}** — ${formatRelative(item.createdAt)}\n`;
        if (item.body) {
          const body = item.body.length > 100 ? item.body.substring(0, 100) + "..." : item.body;
          out += `  ${body}\n`;
        }
      }

      return out.trim();
    },
  },

  {
    name: "mark_notifications_read",
    description:
      "Đánh dấu thông báo đã đọc. " +
      "Dùng khi: 'Đánh dấu tất cả thông báo đã đọc', 'Đọc thông báo [ID]'.",
    inputSchema: {
      type: "object",
      properties: {
        notificationId: { type: "string", description: "ID thông báo (bỏ trống để đánh dấu tất cả)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const id = args["notificationId"] as string;

      if (id) {
        try {
          await client.patch<unknown>(`/notifications/${id}/read`, {});
        } catch (e) {
          // Fallback if endpoint is different
          await client.patch<unknown>("/notifications", { id, read: true });
        }
        return `✅ Đã đọc thông báo`;
      } else {
        try {
          await client.patch<unknown>("/notifications/read-all", {});
        } catch (e) {
          // Fallback if endpoint is different
          await client.patch<unknown>("/notifications", { readAll: true });
        }
        return `✅ Đã đánh dấu tất cả thông báo đã đọc`;
      }
    },
  },
];

interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  type?: string;
  createdAt: string;
  isRead?: boolean;
}
