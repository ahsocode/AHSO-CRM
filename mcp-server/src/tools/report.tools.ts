import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatVND, formatVNDShort, formatDate, stageLabel } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

function periodParams(period: string): Record<string, string> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  switch (period) {
    case "this_month":
      return {
        dateFrom: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
        dateTo: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
          new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        )}`,
      };
    case "last_month": {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        dateFrom: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-01`,
        dateTo: `${lastEnd.getFullYear()}-${pad(lastEnd.getMonth() + 1)}-${pad(lastEnd.getDate())}`,
      };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), q * 3, 1);
      const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      return {
        dateFrom: `${qStart.getFullYear()}-${pad(qStart.getMonth() + 1)}-01`,
        dateTo: `${qEnd.getFullYear()}-${pad(qEnd.getMonth() + 1)}-${pad(qEnd.getDate())}`,
      };
    }
    case "this_year":
      return {
        dateFrom: `${now.getFullYear()}-01-01`,
        dateTo: `${now.getFullYear()}-12-31`,
      };
    default:
      return {};
  }
}

const PERIOD_LABEL: Record<string, string> = {
  this_month: "tháng này",
  last_month: "tháng trước",
  this_quarter: "quý này",
  this_year: "năm nay",
};

export const reportTools: McpTool[] = [
  {
    name: "get_revenue_summary",
    description:
      "Báo cáo doanh thu theo khoảng thời gian. " +
      "Dùng khi: 'Doanh thu tháng này bao nhiêu?', 'Tổng hợp doanh thu quý này'.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["this_month", "last_month", "this_quarter", "this_year"],
          description: "Khoảng thời gian",
        },
      },
      required: ["period"],
    },
    async handler(args) {
      const client = getApiClient();
      const period = args["period"] as string;
      const params = periodParams(period);

      const res = await client.get<unknown>("/reports/revenue", { params });
      const data = extractData<RevenueReport>(res.data);

      const label = PERIOD_LABEL[period] ?? period;
      let out = `💰 **Báo cáo doanh thu ${label}:**\n\n`;

      if (data.totalRevenue != null) {
        out += `📈 Tổng doanh thu: **${formatVND(data.totalRevenue)}**\n`;
      }
      if (data.totalContracts != null) {
        out += `📃 Hợp đồng hoàn thành: ${data.totalContracts}\n`;
      }
      if (data.totalPayments != null) {
        out += `💸 Tổng đã thu: **${formatVND(data.totalPayments)}**\n`;
      }
      if (data.growth != null) {
        const growthSign = data.growth >= 0 ? "+" : "";
        out += `📊 Tăng trưởng so với kỳ trước: ${growthSign}${data.growth.toFixed(1)}%\n`;
      }

      if (data.monthly?.length) {
        out += `\n📅 **Theo tháng:**\n`;
        out += data.monthly
          .map((m) => `  ${m.month}: ${formatVNDShort(m.revenue)}`)
          .join("\n");
      }

      if (data.topCustomers?.length) {
        out += `\n\n🏆 **Top khách hàng:**\n`;
        out += data.topCustomers
          .slice(0, 5)
          .map((c, i) => `  ${i + 1}. ${c.name}: ${formatVND(c.revenue)}`)
          .join("\n");
      }

      return out;
    },
  },

  {
    name: "get_pipeline_stats",
    description:
      "Thống kê pipeline: tỷ lệ thắng, tổng giá trị theo giai đoạn, xu hướng. " +
      "Dùng khi: 'Tỷ lệ thắng quý này thế nào?', 'Tổng giá trị pipeline hiện tại?'",
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", description: "Khoảng thời gian (tuỳ chọn)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {};
      if (args["period"]) {
        const range = periodParams(args["period"] as string);
        Object.assign(params, range);
      }

      const res = await client.get<unknown>("/reports/pipeline", { params });
      const data = extractData<PipelineReport>(res.data);

      let out = `📊 **Thống kê Pipeline:**\n\n`;

      if (data.winRate != null) {
        out += `🎯 Tỷ lệ thắng: **${data.winRate.toFixed(1)}%**\n`;
      }
      if (data.totalPipelineValue != null) {
        out += `💰 Tổng giá trị pipeline: **${formatVND(data.totalPipelineValue)}**\n`;
      }
      if (data.avgDealSize != null) {
        out += `📏 Giá trị deal trung bình: ${formatVND(data.avgDealSize)}\n`;
      }

      if (data.byStage?.length) {
        out += `\n📈 **Theo giai đoạn:**\n`;
        out += data.byStage
          .map(
            (s) =>
              `  ${stageLabel(s.stage)}: ${s.count} deal — ${formatVNDShort(s.totalValue)}`
          )
          .join("\n");
      }

      return out || "📊 Chưa có dữ liệu pipeline.";
    },
  },

  {
    name: "get_overdue_followups",
    description:
      "Tìm khách hàng chưa được liên hệ trong N ngày gần đây. " +
      "Dùng khi: 'Khách nào chưa liên hệ hơn 30 ngày?', 'Danh sách cần follow-up'.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Số ngày không có hoạt động (mặc định 30)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const days = (args["days"] as number) ?? 30;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10);

      // Lấy tất cả KH active bằng pagination loop
      const allCustomers: CustomerBase[] = [];
      let page = 1;
      const PAGE_SIZE = 100;
      while (true) {
        const res = await client.get<unknown>("/customers", {
          params: { limit: PAGE_SIZE, page, status: "ACTIVE" },
        });
        const items = extractData<CustomerBase[]>(res.data);
        allCustomers.push(...items);
        const meta = extractMeta(res.data);
        if (!meta || page >= meta.totalPages) break;
        page++;
      }
      const customers = allCustomers;

      // Lấy activities trong N ngày gần đây
      const activitiesRes = await client.get<unknown>("/activities", {
        params: { limit: 100, page: 1, dateFrom: cutoffStr },
      });
      const recentActivities = extractData<ActivityRef[]>(activitiesRes.data);

      // Set KH đã có hoạt động trong N ngày
      const activeIds = new Set(
        recentActivities.flatMap((a) => (a.customerId ? [a.customerId] : []))
      );

      const overdue = customers
        .filter((c) => !activeIds.has(c.id))
        .sort((a, b) => new Date(a.updatedAt ?? 0).getTime() - new Date(b.updatedAt ?? 0).getTime());

      if (!overdue.length) {
        return `✅ Tất cả khách hàng đều đã được liên hệ trong vòng ${days} ngày. Tốt lắm!`;
      }

      const lines = overdue
        .slice(0, 15)
        .map((c) => `  • **${c.name}** (${c.code ?? "—"}) | ID: ${c.id}`);

      return (
        `⚠️ **${overdue.length} khách hàng chưa có hoạt động trong ${days} ngày qua:**\n\n` +
        lines.join("\n") +
        (overdue.length > 15 ? `\n  ... và ${overdue.length - 15} KH khác` : "") +
        `\n\n💡 Dùng add_activity_note để ghi nhận liên lạc, hoặc create_task để lên lịch follow-up.`
      );
    },
  },

  {
    name: "get_outstanding_debt",
    description:
      "Xem tình trạng công nợ: số tiền chưa thu, hợp đồng quá hạn thanh toán. " +
      "Dùng khi: 'Công nợ quá hạn là bao nhiêu?', 'Hợp đồng nào chưa thanh toán?'",
    inputSchema: {
      type: "object",
      properties: {
        overdueOnly: {
          type: "boolean",
          description: "Chỉ xem hợp đồng quá hạn (mặc định: false — xem tất cả còn nợ)",
        },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const overdueOnly = (args["overdueOnly"] as boolean) ?? false;

      const params: Record<string, unknown> = {
        limit: 30,
        page: 1,
        status: "ACTIVE",
        hasOutstanding: true,
      };
      if (overdueOnly) params["overdueOnly"] = true;

      const res = await client.get<unknown>("/contracts", { params });
      const items = extractData<ContractWithDebt[]>(res.data);

      if (!items.length) {
        return overdueOnly
          ? "✅ Không có hợp đồng nào quá hạn thanh toán."
          : "✅ Không có công nợ tồn đọng.";
      }

      const totalOutstanding = items.reduce(
        (s, c) => s + (Number(c.outstanding) || 0),
        0
      );
      const overdueContracts = items.filter(
        (c) => c.nextMilestoneDue && new Date(c.nextMilestoneDue) < new Date()
      );

      let out = `💳 **Báo cáo công nợ:**\n`;
      out += `📊 Tổng còn nợ: **${formatVND(totalOutstanding)}**\n`;
      out += `📋 Số hợp đồng: ${items.length}`;
      if (overdueContracts.length) {
        out += ` (${overdueContracts.length} quá hạn ⚠️)`;
      }
      out += "\n\n";

      out += items
        .slice(0, 10)
        .map((c) => {
          const isOverdue = c.nextMilestoneDue && new Date(c.nextMilestoneDue) < new Date();
          const flag = isOverdue ? " ⚠️" : "";
          return (
            `  ${flag}**${c.contractNo}** — ${c.customer?.name ?? "—"}\n` +
            `   💰 Còn nợ: ${formatVND(c.outstanding)}` +
            (c.nextMilestoneDue ? ` | 📅 Hạn TT: ${formatDate(c.nextMilestoneDue)}` : "")
          );
        })
        .join("\n");

      if (items.length > 10) out += `\n  ... và ${items.length - 10} HĐ khác`;

      return out;
    },
  },
];

// Interfaces

interface RevenueReport {
  totalRevenue?: number;
  totalContracts?: number;
  totalPayments?: number;
  growth?: number;
  monthly?: Array<{ month: string; revenue: number }>;
  topCustomers?: Array<{ name: string; revenue: number }>;
}

interface PipelineReport {
  winRate?: number;
  totalPipelineValue?: number;
  avgDealSize?: number;
  byStage?: Array<{ stage: string; count: number; totalValue: number }>;
}

interface CustomerBase {
  id: string;
  name: string;
  code?: string;
  updatedAt?: string;
}

interface ActivityRef {
  id: string;
  customerId?: string | null;
}

interface ContractWithDebt {
  id: string;
  contractNo: string;
  outstanding?: number | string;
  nextMilestoneDue?: string;
  customer?: { name: string };
}
