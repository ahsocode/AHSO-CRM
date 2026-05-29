import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatVND, formatDate, formatRelative } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "📝 Bản nháp",
  SIGNED: "✍️ Đã ký",
  ACTIVE: "🟢 Đang hiệu lực",
  CLOSED: "✅ Đã đóng",
  CANCELLED: "❌ Đã huỷ",
};

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  PENDING: "⏳ Chờ",
  IN_PROGRESS: "🔄 Đang làm",
  DONE: "✅ Xong",
  ACCEPTED: "✅ Nghiệm thu",
};

export const contractTools: McpTool[] = [
  {
    name: "list_contracts",
    description:
      "Danh sách hợp đồng đang hiệu lực hoặc theo khách hàng. " +
      "Dùng khi: 'Hợp đồng đang chạy?', 'HĐ của Sabeco là gì?'",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["DRAFT", "SIGNED", "ACTIVE", "CLOSED", "CANCELLED"],
          description: "Lọc theo trạng thái (tuỳ chọn)",
        },
        customerId: { type: "string", description: "ID khách hàng (tuỳ chọn)" },
        limit: { type: "number", description: "Số kết quả (mặc định 10)" },
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

      const res = await client.get<unknown>("/contracts", { params });
      const items = extractData<ContractListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy hợp đồng nào.";

      const lines = items.map((c) => {
        const status = CONTRACT_STATUS_LABEL[c.status ?? ""] ?? c.status ?? "—";
        return (
          `  • **${c.contractNo}** ${status}\n` +
          `    KH: ${c.project?.customer?.name ?? "—"} | ${formatVND(c.value)} | Ký: ${formatDate(c.signedAt)}`
        );
      });

      return (
        `📃 **Hợp đồng** (${meta?.total ?? items.length} tổng):\n\n` +
        lines.join("\n")
      );
    },
  },

  {
    name: "get_contract_detail",
    description:
      "Xem chi tiết hợp đồng: milestones, lịch thanh toán, tình trạng. " +
      "Dùng khi: 'Tiến độ HĐ Sabeco đến đâu?', 'Milestone nào chưa xong?'",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "ID hợp đồng (lấy từ list_contracts)" },
      },
      required: ["contractId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/contracts/${args["contractId"] as string}`);
      const c = extractData<ContractDetail>(res.data);

      const status = CONTRACT_STATUS_LABEL[c.status ?? ""] ?? c.status ?? "—";
      let out = `📃 **Hợp đồng ${c.contractNo}** — ${status}\n`;
      out += `🏢 Khách hàng: ${c.project?.customer?.name ?? "—"}\n`;
      if (c.project?.name) out += `📁 Dự án: ${c.project.name}\n`;
      out += `💰 Giá trị: **${formatVND(c.value)}**\n`;
      if (c.signedAt) out += `✍️ Ngày ký: ${formatDate(c.signedAt)}\n`;
      if (c.startDate) out += `▶️ Ngày bắt đầu: ${formatDate(c.startDate)}\n`;
      if (c.endDate) out += `🏁 Ngày kết thúc: ${formatDate(c.endDate)}\n`;

      // Tổng kết thanh toán
      const totalPaid = c.payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) ?? 0;
      const outstanding = (Number(c.value) || 0) - totalPaid;
      if (totalPaid > 0 || c.value) {
        out += `\n💳 **Thanh toán:** Đã thu ${formatVND(totalPaid)} / Còn lại ${formatVND(outstanding > 0 ? outstanding : 0)}\n`;
      }

      if (c.milestones?.length) {
        out += `\n📋 **Milestones (${c.milestones.length}):**\n`;
        out += c.milestones
          .map((m) => {
            const msStatus = MILESTONE_STATUS_LABEL[m.status ?? ""] ?? m.status ?? "—";
            const overdue =
              m.dueDate &&
              m.status !== "DONE" &&
              m.status !== "ACCEPTED" &&
              new Date(m.dueDate) < new Date()
                ? " ⚠️ QUÁ HẠN"
                : "";
            return (
              `  • ${msStatus} **${m.name}**${overdue}\n` +
              (m.dueDate ? `    📅 Hạn: ${formatDate(m.dueDate)}` : "") +
              (m.paymentAmount ? ` | 💰 ${formatVND(m.paymentAmount)}` : "")
            );
          })
          .join("\n");
      }

      if (c.payments?.length) {
        out += `\n\n💸 **Lịch sử thanh toán:**\n`;
        out += c.payments
          .slice(0, 5)
          .map((p) => `  • ${formatVND(p.amount)} — ${formatDate(p.paidAt)} — ${p.method ?? "—"}`)
          .join("\n");
      }

      return out;
    },
  },
];

// Interfaces

interface ContractListItem {
  id: string;
  contractNo: string;
  status?: string;
  value?: number | string;
  signedAt?: string;
  project?: { name?: string; customer?: { name: string } };
}

interface ContractDetail {
  id: string;
  contractNo: string;
  status?: string;
  value?: number | string;
  signedAt?: string;
  startDate?: string;
  endDate?: string;
  project?: { name: string; customer?: { name: string } };
  milestones?: Array<{
    name: string;
    status?: string;
    dueDate?: string;
    paymentAmount?: number | string;
  }>;
  payments?: Array<{
    amount: number | string;
    paidAt: string;
    method?: string;
  }>;
}
