import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDateTime } from "../formatters/common.formatter.js";
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

function taskIdLine(event: CalendarEvent): string {
  return `    🆔 ID: ${event.id}`;
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

      const res = await client.get<unknown>("/calendar/events", { params });
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

      // Tách completed và pending (API trả scheduledAt / anchorAt thay vì dueDate/startDate)
      const pending = items.filter((e) => !e.isCompleted);
      const done = items.filter((e) => e.isCompleted);

      let out = `📅 **Công việc ${periodLabel[period] ?? period}** (${meta?.total ?? items.length} tổng):\n\n`;

      if (pending.length) {
        out += `⏳ **Chờ xử lý (${pending.length}):**\n`;
        out += pending
          .map((e) => {
            const due = e.scheduledAt ?? e.anchorAt;
            const overdue =
              due && new Date(due) < new Date() && period !== "today" ? " ⚠️ QUÁ HẠN" : "";
            return (
              `  • ${e.title}${overdue}\n` +
              `${taskIdLine(e)}\n` +
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
          .map((e) => `  • ~~${e.title}~~\n${taskIdLine(e)}`)
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
        notes: { type: "string", description: "Ghi chú thêm" },
      },
      required: ["title"],
    },
    async handler(args) {
      const client = getApiClient();
      // Không có type TASK — dùng FOLLOWUP là phù hợp nhất cho công việc cần theo dõi
      const payload: Record<string, unknown> = {
        title: args["title"],
        type: "FOLLOWUP",
      };
      if (args["dueDate"]) payload["scheduledAt"] = args["dueDate"];
      if (args["customerId"]) payload["customerId"] = args["customerId"];
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["notes"]) payload["content"] = args["notes"];

      const res = await client.post<unknown>("/activities", payload);
      const e = extractData<{ id: string; title: string; scheduledAt?: string }>(res.data);

      return (
        `✅ Đã tạo task:\n` +
        `📋 **${e.title}**\n` +
        (e.scheduledAt ? `📅 Hạn: ${formatDateTime(e.scheduledAt)}\n` : "") +
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

      const res = await client.patch<unknown>(`/activities/${id}`, { isCompleted: true });
      const e = extractData<{ title: string; doneAt?: string }>(res.data);

      return (
        `✅ Đã hoàn thành: **${e.title}**\n` +
        (e.doneAt ? `⏰ Lúc: ${formatDateTime(e.doneAt)}` : "")
      );
    },
  },

  {
    name: "update_task",
    description:
      "Cập nhật thông tin task hoặc lịch hẹn. " +
      "Dùng khi: 'Dời deadline task gọi Sabeco sang thứ 6', 'Đổi priority task demo thành high'.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID task" },
        title: { type: "string", description: "Tiêu đề task" },
        dueDate: { type: "string", description: "Ngày hạn (ISO datetime)" },
        projectId: { type: "string", description: "ID dự án" },
        customerId: { type: "string", description: "ID khách hàng" },
        notes: { type: "string", description: "Ghi chú" },
      },
      required: ["taskId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      if (args["title"]) payload["title"] = args["title"];
      if (args["dueDate"]) payload["scheduledAt"] = args["dueDate"];
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["customerId"]) payload["customerId"] = args["customerId"];
      if (args["notes"]) payload["content"] = args["notes"];

      const res = await client.patch<unknown>(`/activities/${args["taskId"] as string}`, payload);
      const e = extractData<{ title: string }>(res.data);

      return `✅ Đã cập nhật task "${e.title}" kèm thay đổi`;
    },
  },

  {
    name: "delete_task",
    description:
      "Xóa một task khỏi hệ thống. " +
      "Dùng khi: 'Xóa task X không còn cần thiết nữa'.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID task cần xóa" },
      },
      required: ["taskId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.delete<unknown>(`/activities/${args["taskId"] as string}`);
      const e = extractData<{ title: string }>(res.data);

      return `✅ Đã xóa task "${e.title ?? args["taskId"]}"`;
    },
  },

  {
    name: "get_team_tasks",
    description:
      "Xem danh sách công việc của cả team hoặc của nhân viên khác. (Dành cho MANAGER/ADMIN). " +
      "Dùng khi: 'Tasks của anh Minh tuần này', 'Tất cả tasks quá hạn của team', 'Tasks liên quan dự án AHSO-307'.",
    inputSchema: {
      type: "object",
      properties: {
        assignedToId: { type: "string", description: "ID nhân viên (tuỳ chọn, bỏ trống để xem tất cả)" },
        projectId: { type: "string", description: "Lọc theo ID dự án" },
        completed: { type: "boolean", description: "Trạng thái hoàn thành (true/false)" },
        dateFrom: { type: "string", description: "Từ ngày (YYYY-MM-DD)" },
        dateTo: { type: "string", description: "Đến ngày (YYYY-MM-DD)" },
        limit: { type: "number", description: "Số kết quả tối đa (mặc định 20)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = { limit: args["limit"] ?? 20, page: 1 };
      if (args["assignedToId"]) params["assignedTo"] = args["assignedToId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];
      if (args["completed"] !== undefined) params["completed"] = args["completed"];
      if (args["dateFrom"]) params["dateFrom"] = args["dateFrom"];
      if (args["dateTo"]) params["dateTo"] = args["dateTo"];

      const res = await client.get<unknown>("/calendar/events", { params });
      const items = extractData<CalendarEvent[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) {
        return `✅ Không tìm thấy công việc nào phù hợp.`;
      }

      const pending = items.filter((e) => !e.isCompleted);
      const done = items.filter((e) => e.isCompleted);

      let out = `📅 **Công việc Team** (${meta?.total ?? items.length} tổng):\n\n`;

      if (pending.length) {
        out += `⏳ **Chờ xử lý (${pending.length}):**\n`;
        out += pending
          .map((e) => {
            const due = e.scheduledAt ?? e.anchorAt;
            const assignee = e.user?.name ?? "Chưa phân công";
            return (
              `  • [${assignee}] ${e.title}\n` +
              `${taskIdLine(e)}\n` +
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
          .map((e) => {
            const assignee = e.user?.name ?? "Chưa phân công";
            return `  • ~~[${assignee}] ${e.title}~~\n${taskIdLine(e)}`;
          })
          .join("\n");
      }

      return out;
    },
  },
];

// Interfaces

interface CalendarEvent {
  id: string;
  title: string;
  scheduledAt?: string;
  anchorAt?: string;
  doneAt?: string;
  isCompleted?: boolean;
  customer?: { name: string };
  project?: { name: string };
  user?: { name?: string; email?: string };
}
