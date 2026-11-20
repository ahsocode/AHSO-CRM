import { getApiClient, extractData } from "../auth/api-client.js";
import { formatDate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

interface CostingConfigResponse {
  current: { method: string; effectiveFrom: string | null; isDefault: boolean };
  history: Array<{
    method: string;
    effectiveFrom: string;
    reason: string | null;
    changedByName: string | null;
    isFuture: boolean;
  }>;
}

function renderConfig(config: CostingConfigResponse): string {
  const since = config.current.isDefault
    ? "mặc định từ trước đến nay"
    : `hiệu lực từ ${formatDate(config.current.effectiveFrom ?? "")}`;
  let out = `⚙️ **Phương pháp tính giá xuất hiện hành:** ${config.current.method} (${since})\n`;
  if (config.history.length) {
    out += `\n📜 **Lịch sử đổi phương pháp:**\n`;
    out += config.history
      .map(
        (row) =>
          `- ${formatDate(row.effectiveFrom)}: ${row.method}${row.isFuture ? " (chưa hiệu lực)" : ""} | ` +
          `Người đổi: ${row.changedByName ?? "—"} | Lý do: ${row.reason ?? "—"}`
      )
      .join("\n");
  } else {
    out += `Chưa có lần đổi nào (AVERAGE = bình quân gia quyền di động).`;
  }
  return out;
}

export const inventoryCostingTools: McpTool[] = [
  {
    name: "get_costing_config",
    description:
      "Xem phương pháp tính giá xuất kho đang áp dụng (AVERAGE = bình quân gia quyền di động, mặc định; FIFO) và lịch sử đổi " +
      "(người đổi, ngày hiệu lực, lý do). Dùng khi: 'Kho đang tính giá xuất theo phương pháp nào?'.",
    inputSchema: { type: "object", properties: {}, required: [] },
    async handler() {
      const client = getApiClient();
      const res = await client.get<unknown>("/inventory/costing-config");
      return renderConfig(extractData<CostingConfigResponse>(res.data));
    }
  },

  {
    name: "set_costing_config",
    description:
      "Đổi phương pháp tính giá xuất kho (AVERAGE | FIFO). CHỈ ADMIN. Phương pháp khóa theo năm tài chính (năm dương lịch): " +
      "effectiveFrom phải là ngày 01/01 của năm SAU năm hiện tại trở đi; đổi giữa năm bị từ chối. Bắt buộc có lý do (>= 5 ký tự). " +
      "Chỉ dùng khi user yêu cầu rõ ràng.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", enum: ["AVERAGE", "FIFO"], description: "Phương pháp tính giá xuất" },
        effectiveFrom: { type: "string", description: "Ngày hiệu lực = đầu năm tài chính sau, dạng YYYY-01-01" },
        reason: { type: "string", description: "Lý do đổi (>= 5 ký tự)" }
      },
      required: ["method", "effectiveFrom", "reason"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.put<unknown>("/inventory/costing-config", {
        method: args["method"],
        effectiveFrom: args["effectiveFrom"],
        reason: args["reason"]
      });
      return `✅ Đã ghi cấu hình tính giá xuất.\n\n${renderConfig(extractData<CostingConfigResponse>(res.data))}`;
    }
  }
];
