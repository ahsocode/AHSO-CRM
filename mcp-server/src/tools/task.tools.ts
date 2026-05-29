import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDate, formatDateTime, formatRelative } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

function periodToDateRange(period: string): { dateFrom?: string; dateTo?: string; filter?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case "today": {
      const today = fmt(now);
      return { dateFrom: today, dateTo: today };
    }
    case "week": {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((day + 6) % 7)); // Monday
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6); // Sunday
      return { dateFrom: fmt(mon), dateTo: fmt(sun) };
    }
    case "overdue": {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { dateTo: fmt(yesterday), filter: "overdue" };
    }
    default:
      return {};
  }
}

export const taskTools: McpTool[] = [
  {
    name: "get_my_tasks",
    description:
      "Xem danh sách công việc và lịch hẹn. " +
      "Dùng khi: 'Hôm nay tôi cần làm gì?', 'Task nào quá hạn?', 'Lịch tuần này thế nào?'",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "week", "overdue"],
          description: "Khoảng thời gian: today (hôm nay) | week (tuần này) | overdue (quá hạn)",
        },
        assignedTo: { type: "string", description: "ID nhân viên (tuỳ chọn, mặc định: bản thân)" },
      },
      required: ["period"],
    },
    async handler(args) {
      const client = getApiClient();
      const period = (args["period"] as string) ?? "today";
      const range = periodToDateRange(period);

      const params: Record<string, unknown> = { limit: 30, page: 1 };
      if (range.dateFrom) params["dateFrom"] = range.dateFrom;
      if (range.dateTo) params["dateTo"] = range.dateTo;
      if (period === "overdue") params["completed"] = false;
      if (args["assignedTo"]) params["assignedTo"] = args["assignedTo"];

      const res = await client.get<unknown>("/calendar", { params });
      const items = extractData<CalendarEvent[]>(res.data);
      const meta = extractMeta(res.data);

      const periodLabel: Record<string, string> = {
        today: "hôm nay",
        week: "tuần này",
        overdue: "quá hạn",
      };

      if (!items.length) {
        return `✅ Không có công việc ${periodLabel[period] ?? period}.`;
      }

      // Tách completed và pending
      const pending = items.filter((e) => !e.isCompleted && !e.isDone);
      const done = items.filter((e) => e.isCompleted || e.isDone);

      let out = `📅 **Công việc ${periodLabel[period] ?? period}** (${meta?.total ?? items.length} tổng):\n\n`;

      if (pending.length) {
        out += `⏳ **Chờ xử lý (${pending.length}):**\n`;
        out += pending
          .map((e) => {
            const due = e.dueDate ?? e.startDate;
            const overdue =
              due && new Date(due) < new Date() && period !== "today" ? " ⚠️ QUÁ HẠN" : "";
            return (
              `  • ${e.title}${overdue}\n` +
              `    📅 ${due ? formatDateTime(due) : "Chưa có hạn"}` +
              (e.customer ? ` | 🏢 ${e.customer.name}` : "") +
              (e.project ? ` | ${e.project.name}` : "")
            );
          })
          .join("\n");
      }

      if (done.length) {
        out += `\n\n✅ **Đã hoàn thành (${done.length}):**\n`;
        out += done
          .map((e) => `  • ~~${e.title}~~`)
          .join("\n");
      }

      return out;
    },
  },

  {
    name: "create_task",
    description:
      "Tạo task hoặc lịch hẹn mới. " +
      "Dùng khi: 'Nhắc tôi gọi lại anh Minh Sabeco thứ 6', 'Đặt lịch demo với Vinamilk tuần sau'.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tiêu đề task" },
        dueDate: { type: "string", description: "Ngày hạn (ISO 8601: 2026-06-01T09:00:00)" },
        customerId: { type: "string", description: "ID khách hàng liên quan (tuỳ chọn)" },
        projectId: { type: "string", description: "ID dự án liên quan (tuỳ chọn)" },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Mức ưu tiên (mặc định: normal)",
        },
        notes: { type: "string", description: "Ghi chú thêm" },
      },
      required: ["title"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        title: args["title"],
        type: "TASK",
        priority: (args["priority"] as string) ?? "normal",
      };
      if (args["dueDate"]) payload["dueDate"] = args["dueDate"];
      if (args["customerId"]) payload["customerId"] = args["customerId"];
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>("/calendar", payload);
      const e = extractData<{ id: string; title: string; dueDate?: string }>(res.data);

      return (
        `✅ Đã tạo task:\n` +
        `📋 **${e.title}**\n` +
        (e.dueDate ? `📅 Hạn: ${formatDateTime(e.dueDate)}\n` : "") +
        `ID: ${e.id}`
      );
    },
  },

  {
    name: "complete_task",
    description:
      "Đánh dấu task đã hoàn thành. " +
      "Dùng khi: 'Xong rồi task gọi điện Vinamilk', 'Đánh dấu hoàn thành [ID task]'.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID task (lấy từ get_my_tasks)" },
      },
      required: ["taskId"],
    },
    async handler(args) {
      const client = getApiClient();
      const id = args["taskId"] as string;

      const res = await client.patch<unknown>(`/calendar/${id}/complete`, {});
      const e = extractData<{ title: string; completedAt?: string }>(res.data);

      return (
        `✅ Đã hoàn thành: **${e.title}**\n` +
        (e.completedAt ? `⏰ Lúc: ${formatDateTime(e.completedAt)}` : "")
      );
    },
  },
];

// Interfaces

interface CalendarEvent {
  id: string;
  title: string;
  startDate?: string;
  dueDate?: string;
  isCompleted?: boolean;
  isDone?: boolean;
  priority?: string;
  customer?: { name: string };
  project?: { name: string };
}
