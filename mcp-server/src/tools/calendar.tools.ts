import { getApiClient, extractData } from "../auth/api-client.js";
import { formatDateTime } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export const calendarTools: McpTool[] = [
  {
    name: "get_calendar",
    description:
      "Xem lịch làm việc theo ngày, hiển thị các sự kiện, cuộc gọi, meeting. " +
      "Dùng khi: 'Lịch tuần này', 'Hôm nay có gì không?', 'Lịch tháng 6'.",
    inputSchema: {
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Từ ngày (YYYY-MM-DD)" },
        dateTo: { type: "string", description: "Đến ngày (YYYY-MM-DD)" },
        type: { type: "string", description: "Lọc theo loại sự kiện" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = { limit: 50 };
      
      let fromStr = args["dateFrom"] as string;
      let toStr = args["dateTo"] as string;

      if (!fromStr || !toStr) {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const pad = (n: number) => String(n).padStart(2, "0");
        const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (!fromStr) fromStr = fmt(today);
        if (!toStr) toStr = fmt(nextWeek);
      }
      
      params["dateFrom"] = fromStr;
      params["dateTo"] = toStr;
      if (args["type"]) params["type"] = args["type"];

      const res = await client.get<unknown>("/calendar", { params });
      const items = extractData<CalendarEvent[]>(res.data);

      const fromDateObj = new Date(fromStr);
      const toDateObj = new Date(toStr);
      const header = `📅 Lịch ${fromDateObj.toLocaleDateString("vi-VN")} – ${toDateObj.toLocaleDateString("vi-VN")}:\n\n`;

      if (!items.length) {
        return header + "✅ Trống";
      }

      const grouped = new Map<string, CalendarEvent[]>();
      for (const item of items) {
        const dateStr = item.startDate ?? item.dueDate;
        if (!dateStr) continue;
        const date = new Date(dateStr);
        const pad = (n: number) => String(n).padStart(2, "0");
        const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }

      // Sort dates
      const sortedKeys = Array.from(grouped.keys()).sort();
      
      let out = header;
      for (const key of sortedKeys) {
        const date = new Date(key);
        const dayName = DAY_NAMES[date.getDay()];
        const dateFormatted = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;
        out += `📅 ${dayName}, ${dateFormatted}:\n`;
        
        const dayItems = grouped.get(key)!.sort((a, b) => {
          const tA = new Date(a.startDate ?? a.dueDate ?? 0).getTime();
          const tB = new Date(b.startDate ?? b.dueDate ?? 0).getTime();
          return tA - tB;
        });

        for (const item of dayItems) {
          const t = new Date(item.startDate ?? item.dueDate ?? 0);
          const timeStr = `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`;
          
          let title = item.title;
          let icon = "⏳";
          if (item.type === "MEETING") icon = "🤝";
          if (item.type === "CALL") icon = "📞";
          if (item.type === "DEMO") icon = "💻";
          
          if (item.priority === "high") title += " [HIGH]";
          
          out += `  ${timeStr} ${icon} ${title}`;
          if (item.customer) out += ` — ${item.customer.name}`;
          if (item.project) out += ` [${item.project.code ?? item.project.name}]`;
          out += `\n    🆔 ID: ${item.id}\n`;
        }
        out += "\n";
      }

      return out.trim();
    },
  },

  {
    name: "schedule_activity",
    description:
      "Lên lịch cuộc gọi, cuộc họp, demo, v.v. " +
      "Dùng khi: 'Lên lịch gặp Sabeco thứ 4 tuần sau 10h', 'Đặt lịch demo Vinamilk ngày 15/06 lúc 14h'.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tiêu đề" },
        scheduledAt: { type: "string", description: "Thời gian diễn ra (ISO datetime: 2026-06-15T09:00:00)" },
        type: {
          type: "string",
          enum: ["MEETING", "CALL", "DEMO", "FOLLOWUP", "SURVEY"],
          description: "Loại hoạt động (mặc định MEETING)",
        },
        customerId: { type: "string", description: "ID khách hàng" },
        projectId: { type: "string", description: "ID dự án" },
        durationMinutes: { type: "number", description: "Thời lượng (phút)" },
        notes: { type: "string", description: "Ghi chú thêm" },
      },
      required: ["title", "scheduledAt"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        title: args["title"],
        scheduledAt: args["scheduledAt"],
        type: args["type"] ?? "MEETING",
      };
      if (args["customerId"]) payload["customerId"] = args["customerId"];
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["durationMinutes"]) payload["durationMinutes"] = args["durationMinutes"];
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>("/calendar", payload);
      const e = extractData<{ id: string; type: string; title: string; scheduledAt: string }>(res.data);

      return (
        `✅ Đã lên lịch ${e.type}: "${e.title}" — ` +
        `${formatDateTime(e.scheduledAt ?? args["scheduledAt"] as string)}\n` +
        `ID: ${e.id}`
      );
    },
  },
];

interface CalendarEvent {
  id: string;
  title: string;
  type?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  customer?: { name: string };
  project?: { code?: string; name: string };
}
