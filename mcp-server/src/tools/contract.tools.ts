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
          `  • **${c.contractNo}** ${status} | ID: \`${c.id}\`\n` +
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
              `    🆔 ID: ${m.id}` +
              (m.dueDate ? `\n    📅 Hạn: ${formatDate(m.dueDate)}` : "") +
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

  {
    name: "create_contract",
    description:
      "Tạo hợp đồng mới cho một dự án. " +
      "Dùng khi: 'Tạo hợp đồng cho AHSO-307 giá trị 2.5 tỷ', 'Ký hợp đồng với Sabeco, ký ngày 15/06/2026'.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID dự án" },
        value: { type: "number", description: "Giá trị hợp đồng (VND)" },
        quoteId: { type: "string", description: "ID báo giá (tuỳ chọn)" },
        signedAt: { type: "string", description: "Ngày ký hợp đồng (ISO date string)" },
        startDate: { type: "string", description: "Ngày bắt đầu" },
        endDate: { type: "string", description: "Ngày kết thúc" },
        notes: { type: "string", description: "Ghi chú" },
        internalNote: { type: "string", description: "Ghi chú nội bộ" },
      },
      required: ["projectId", "value"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        projectId: args["projectId"],
        value: args["value"],
      };
      if (args["quoteId"]) payload["quoteId"] = args["quoteId"];
      if (args["signedAt"]) payload["signedAt"] = args["signedAt"];
      if (args["startDate"]) payload["startDate"] = args["startDate"];
      if (args["endDate"]) payload["endDate"] = args["endDate"];
      if (args["notes"]) payload["notes"] = args["notes"];
      if (args["internalNote"]) payload["internalNote"] = args["internalNote"];

      const res = await client.post<unknown>("/contracts", payload);
      const c = extractData<{ id: string; contractNo: string; project?: { code?: string; name?: string } }>(res.data);

      return (
        `✅ Đã tạo hợp đồng:\n` +
        `📃 ${c.contractNo} — 📝 Bản nháp\n` +
        `📁 Dự án: ${c.project?.code ?? "—"} — ${c.project?.name ?? "—"}\n` +
        `💰 Giá trị: ${formatVND(args["value"] as number)}\n` +
        `ID: ${c.id}\n` +
        `💡 Dùng update_milestone_status để cập nhật tiến độ.`
      );
    },
  },

  {
    name: "update_contract",
    description:
      "Cập nhật thông tin hợp đồng: giá trị, ngày ký, ngày bắt đầu/kết thúc, trạng thái. " +
      "Dùng khi: 'Cập nhật giá trị HĐ Sabeco thành 3 tỷ', 'Đổi trạng thái HĐ Vinamilk sang Hoàn thành'.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "ID hợp đồng" },
        value: { type: "number", description: "Giá trị hợp đồng (VND)" },
        status: {
          type: "string",
          enum: ["ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED"],
          description: "Trạng thái mới",
        },
        signDate: { type: "string", description: "Ngày ký (ISO date)" },
        startDate: { type: "string", description: "Ngày bắt đầu (ISO date)" },
        endDate: { type: "string", description: "Ngày kết thúc (ISO date)" },
        notes: { type: "string", description: "Ghi chú" },
      },
      required: ["contractId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      if (args["value"] !== undefined) payload["value"] = args["value"];
      if (args["status"]) payload["status"] = args["status"];
      if (args["signDate"]) payload["signDate"] = args["signDate"];
      if (args["startDate"]) payload["startDate"] = args["startDate"];
      if (args["endDate"]) payload["endDate"] = args["endDate"];
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.patch<unknown>(`/contracts/${args["contractId"] as string}`, payload);
      const c = extractData<{ contractNo: string; status?: string }>(res.data);
      const status = CONTRACT_STATUS_LABEL[c.status ?? ""] ?? c.status ?? "—";
      return `✅ Đã cập nhật hợp đồng **${c.contractNo}** — ${status}`;
    },
  },

  {
    name: "create_milestone",
    description:
      "Thêm milestone mới vào hợp đồng. " +
      "Dùng khi: 'Thêm milestone Nghiệm thu vào HĐ Sabeco, hạn 30/09, giá trị 500 triệu'.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "ID hợp đồng" },
        name: { type: "string", description: "Tên milestone" },
        dueDate: { type: "string", description: "Ngày hạn (ISO date)" },
        paymentAmount: { type: "number", description: "Giá trị thanh toán của milestone (VND)" },
        status: {
          type: "string",
          enum: ["PENDING", "IN_PROGRESS", "DONE", "ACCEPTED"],
          description: "Trạng thái ban đầu (mặc định: PENDING)",
        },
        description: { type: "string", description: "Mô tả chi tiết" },
        notes: { type: "string", description: "Ghi chú" },
      },
      required: ["contractId", "name"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = { name: args["name"] };
      if (args["dueDate"]) payload["dueDate"] = args["dueDate"];
      if (args["paymentAmount"] !== undefined) payload["paymentAmount"] = args["paymentAmount"];
      if (args["status"]) payload["status"] = args["status"];
      if (args["description"]) payload["description"] = args["description"];
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>(
        `/contracts/${args["contractId"] as string}/milestones`,
        payload
      );
      const m = extractData<{ id: string; name: string; dueDate?: string; paymentAmount?: number }>(res.data);

      let out = `✅ Đã thêm milestone **${m.name}**\n`;
      if (m.dueDate) out += `📅 Hạn: ${formatDate(m.dueDate)}\n`;
      if (m.paymentAmount) out += `💰 Giá trị: ${formatVND(m.paymentAmount)}\n`;
      out += `ID: ${m.id}`;
      return out;
    },
  },

  {
    name: "delete_contract",
    description:
      "Xoá hợp đồng khỏi hệ thống. " +
      "Dùng khi: 'Xoá hợp đồng nhập nhầm', 'Xoá HĐ bị huỷ và không cần lưu trữ'.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "ID hợp đồng cần xoá" },
      },
      required: ["contractId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.delete<unknown>(`/contracts/${args["contractId"] as string}`);
      const c = extractData<{ contractNo: string }>(res.data);
      return `✅ Đã xoá hợp đồng "${c.contractNo ?? args["contractId"]}"`;
    },
  },

  {
    name: "update_milestone_status",
    description:
      "Cập nhật trạng thái của một milestone trong hợp đồng. " +
      "Lưu ý: milestoneId lấy từ kết quả get_contract_detail. " +
      "Dùng khi: 'Đánh dấu milestone Triển khai của HĐ-2026-003 đã xong', 'Cập nhật trạng thái bàn giao'.",
    inputSchema: {
      type: "object",
      properties: {
        milestoneId: { type: "string", description: "ID milestone" },
        status: {
          type: "string",
          enum: ["PENDING", "IN_PROGRESS", "DONE", "ACCEPTED"],
          description: "Trạng thái mới",
        },
        notes: { type: "string", description: "Ghi chú" },
      },
      required: ["milestoneId", "status"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = { status: args["status"] };
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.patch<unknown>(`/contracts/milestones/${args["milestoneId"] as string}`, payload);
      const m = extractData<{ name: string; status: string }>(res.data);
      const msStatus = MILESTONE_STATUS_LABEL[m.status] ?? m.status;

      return `✅ Milestone "${m.name}" → ${msStatus}`;
    },
  },

  {
    name: "record_payment",
    description:
      "Ghi nhận thanh toán cho hợp đồng. " +
      "Dùng khi: 'Ghi nhận Sabeco đã chuyển 300 triệu hôm nay', 'Log thanh toán đợt 2 HĐ Vinamilk'.",
    inputSchema: {
      type: "object",
      properties: {
        contractId: { type: "string", description: "ID hợp đồng" },
        amount: { type: "number", description: "Số tiền thanh toán (VND)" },
        paidAt: { type: "string", description: "Ngày thanh toán (ISO date), mặc định hôm nay" },
        method: {
          type: "string",
          enum: ["CASH", "BANK_TRANSFER", "CHECK"],
          description: "Phương thức thanh toán (mặc định BANK_TRANSFER)",
        },
        notes: { type: "string", description: "Ghi chú" },
      },
      required: ["contractId", "amount"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {
        amount: args["amount"],
        paidAt: args["paidAt"] ?? new Date().toISOString(),
        method: args["method"] ?? "BANK_TRANSFER",
      };
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>(`/contracts/${args["contractId"] as string}/payments`, payload);
      const data = extractData<{ contract?: { contractNo?: string }; outstanding?: number; amount: number; method: string; paidAt: string }>(res.data);

      let out = `✅ Đã ghi nhận thanh toán:\n`;
      out += `💸 ${formatVND(args["amount"] as number)} — ${payload.method as string} — ${formatDate(payload.paidAt as string)}\n`;
      if (data.contract?.contractNo) out += `📃 Hợp đồng: ${data.contract.contractNo}\n`;
      if (data.outstanding !== undefined) out += `💰 Còn lại: ${formatVND(data.outstanding)}\n`;

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
    id: string;
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
