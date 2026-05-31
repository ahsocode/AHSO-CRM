import { getApiClient, extractData } from "../auth/api-client.js";
import { formatDate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const NOTE_TYPE_EMOJI: Record<string, string> = {
  GENERAL: "📝",
  TECHNICAL_REQUIREMENT: "🏗️",
  COMMERCIAL_REQUIREMENT: "💰",
  SITE_CONSTRAINT: "🚧",
  RISK: "⚠️",
  DECISION: "✅",
  OPEN_QUESTION: "❓",
};

const NOTE_TYPE_LABEL: Record<string, string> = {
  GENERAL: "Ghi chú chung",
  TECHNICAL_REQUIREMENT: "Yêu cầu kỹ thuật",
  COMMERCIAL_REQUIREMENT: "Yêu cầu thương mại",
  SITE_CONSTRAINT: "Ràng buộc mặt bằng",
  RISK: "Rủi ro",
  DECISION: "Quyết định",
  OPEN_QUESTION: "Câu hỏi mở",
};

export const surveyTools: McpTool[] = [
  {
    name: "list_surveys",
    description:
      "Danh sách các bản khảo sát dự án hoặc khách hàng. " +
      "Dùng khi: 'Khảo sát của dự án AHSO-307', 'Lịch sử khảo sát Sabeco'.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID khách hàng" },
        projectId: { type: "string", description: "ID dự án" },
        limit: { type: "number", description: "Số kết quả tối đa (mặc định 10)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = { limit: args["limit"] ?? 10, page: 1 };
      if (args["customerId"]) params["customerId"] = args["customerId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];

      const res = await client.get<unknown>("/surveys", { params });
      const items = extractData<SurveyItem[]>(res.data);

      if (!items.length) {
        return "✅ Không tìm thấy khảo sát nào.";
      }

      const lines = items.map((s) => {
        let noteStr = "";
        if (s.notesCount !== undefined) {
          noteStr = ` | 📝 ${s.notesCount} ghi chú`;
        }
        return `• [${formatDate(s.surveyDate ?? s.createdAt)}] ${s.title ?? "Khảo sát"} — ${s.location ?? "Chưa rõ địa điểm"}${noteStr}\n  ID: ${s.id}`;
      });

      return `🔍 Danh sách khảo sát (${items.length}):\n\n${lines.join("\n")}`;
    },
  },

  {
    name: "create_survey",
    description:
      "Tạo bản khảo sát mới cho khách hàng hoặc dự án. " +
      "Dùng khi: 'Tạo khảo sát hiện trường cho Sabeco ngày 20/06', 'Ghi nhận kết quả khảo sát dự án AHSO-307'.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Tiêu đề khảo sát" },
        customerId: { type: "string", description: "ID khách hàng (bắt buộc)" },
        projectId: { type: "string", description: "ID dự án liên quan (tuỳ chọn)" },
        surveyedAt: { type: "string", description: "Ngày khảo sát (ISO date)" },
        location: { type: "string", description: "Địa điểm khảo sát" },
        objectives: { type: "string", description: "Mục tiêu khảo sát" },
        summary: { type: "string", description: "Tóm tắt kết quả" },
        nextStep: { type: "string", description: "Bước tiếp theo" },
        customerParticipants: { type: "string", description: "Người tham dự phía khách hàng" },
      },
      required: ["title", "customerId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        title: args["title"],
        customerId: args["customerId"],
      };
      if (args["projectId"]) payload["projectId"] = args["projectId"];
      if (args["surveyedAt"]) payload["surveyedAt"] = args["surveyedAt"];
      if (args["location"]) payload["location"] = args["location"];
      if (args["objectives"]) payload["objectives"] = args["objectives"];
      if (args["summary"]) payload["summary"] = args["summary"];
      if (args["nextStep"]) payload["nextStep"] = args["nextStep"];
      if (args["customerParticipants"]) payload["customerParticipants"] = args["customerParticipants"];

      const res = await client.post<unknown>("/surveys", payload);
      const s = extractData<{ id: string; title: string }>(res.data);

      return (
        `✅ Đã tạo khảo sát:\n` +
        `🔍 **${s.title}**\n` +
        `ID: ${s.id}\n\n` +
        `💡 Dùng add_survey_note để ghi chú yêu cầu kỹ thuật, rủi ro, quyết định.`
      );
    },
  },

  {
    name: "update_survey",
    description:
      "Cập nhật thông tin bản khảo sát. " +
      "Dùng khi: 'Cập nhật tóm tắt khảo sát Sabeco', 'Thêm bước tiếp theo cho khảo sát'.",
    inputSchema: {
      type: "object",
      properties: {
        surveyId: { type: "string", description: "ID khảo sát" },
        title: { type: "string", description: "Tiêu đề" },
        surveyedAt: { type: "string", description: "Ngày khảo sát (ISO date)" },
        location: { type: "string", description: "Địa điểm" },
        objectives: { type: "string", description: "Mục tiêu" },
        summary: { type: "string", description: "Tóm tắt kết quả" },
        nextStep: { type: "string", description: "Bước tiếp theo" },
        customerParticipants: { type: "string", description: "Người tham dự phía khách hàng" },
      },
      required: ["surveyId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      const fields = ["title", "surveyedAt", "location", "objectives", "summary", "nextStep", "customerParticipants"];
      for (const field of fields) {
        if (args[field] !== undefined && args[field] !== null) payload[field] = args[field];
      }

      const res = await client.patch<unknown>(`/surveys/${args["surveyId"] as string}`, payload);
      const s = extractData<{ title: string }>(res.data);
      return `✅ Đã cập nhật khảo sát "${s.title}"`;
    },
  },

  {
    name: "get_survey_detail",
    description:
      "Xem chi tiết bản khảo sát và các phát hiện/ghi chú (findings). " +
      "Dùng khi: 'Chi tiết khảo sát lần 1 Sabeco', 'Yêu cầu kỹ thuật từ khảo sát'.",
    inputSchema: {
      type: "object",
      properties: {
        surveyId: { type: "string", description: "ID khảo sát" },
      },
      required: ["surveyId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/surveys/${args["surveyId"] as string}`);
      const s = extractData<SurveyDetail>(res.data);

      let out = `🔍 **Khảo sát: ${s.title ?? s.location ?? "Không tên"}** — ${formatDate(s.surveyDate ?? s.createdAt)}\n`;
      if (s.project) out += `📁 Dự án: ${s.project.code ?? s.project.name} | 🏢 ${s.project.customer?.name ?? "—"}\n`;
      else if (s.customer) out += `🏢 Khách hàng: ${s.customer.name}\n`;

      if (s.notes && s.notes.length > 0) {
        out += `\n`;
        // Group notes by type
        const groupedNotes: Record<string, SurveyNote[]> = {};
        for (const note of s.notes) {
          const type = note.type ?? "GENERAL";
          if (!groupedNotes[type]) groupedNotes[type] = [];
          groupedNotes[type].push(note);
        }

        const typeOrder = ["TECHNICAL_REQUIREMENT", "COMMERCIAL_REQUIREMENT", "SITE_CONSTRAINT", "RISK", "DECISION", "OPEN_QUESTION", "GENERAL"];

        for (const type of typeOrder) {
          if (groupedNotes[type] && groupedNotes[type].length > 0) {
            const emoji = NOTE_TYPE_EMOJI[type] ?? "📝";
            const label = NOTE_TYPE_LABEL[type] ?? type;
            out += `${emoji} **${label}:**\n`;
            for (const note of groupedNotes[type]) {
              const imp = note.isImportant ? "❗ " : "";
              out += `  • ${imp}${note.content}\n`;
            }
          }
        }
      } else {
        out += `\n✅ Chưa có ghi chú/phát hiện nào.`;
      }

      return out.trim();
    },
  },

  {
    name: "add_survey_note",
    description:
      "Thêm ghi chú, yêu cầu, rủi ro vào bản khảo sát. " +
      "Dùng khi: 'Ghi lại yêu cầu kỹ thuật từ khảo sát Sabeco', 'Đánh dấu rủi ro: trần thấp không lắp được thiết bị'.",
    inputSchema: {
      type: "object",
      properties: {
        surveyId: { type: "string", description: "ID khảo sát" },
        content: { type: "string", description: "Nội dung ghi chú" },
        type: {
          type: "string",
          enum: [
            "GENERAL",
            "TECHNICAL_REQUIREMENT",
            "COMMERCIAL_REQUIREMENT",
            "SITE_CONSTRAINT",
            "RISK",
            "DECISION",
            "OPEN_QUESTION",
          ],
          description: "Loại ghi chú",
        },
        isImportant: { type: "boolean", description: "Đánh dấu quan trọng (mặc định false)" },
      },
      required: ["surveyId", "content", "type"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        content: args["content"],
        type: args["type"],
      };
      if (args["isImportant"] !== undefined) payload["isImportant"] = args["isImportant"];

      await client.post<unknown>(`/surveys/${args["surveyId"] as string}/notes`, payload);
      
      const typeLabel = NOTE_TYPE_LABEL[args["type"] as string] ?? args["type"];
      return `✅ Đã thêm ghi chú [${typeLabel}] vào khảo sát`;
    },
  },
];

interface SurveyItem {
  id: string;
  title?: string;
  location?: string;
  surveyDate?: string;
  createdAt: string;
  notesCount?: number;
}

interface SurveyNote {
  id: string;
  content: string;
  type?: string;
  isImportant?: boolean;
}

interface SurveyDetail {
  id: string;
  title?: string;
  location?: string;
  surveyDate?: string;
  createdAt: string;
  notes?: SurveyNote[];
  project?: { code?: string; name?: string; customer?: { name?: string } };
  customer?: { name?: string };
}
