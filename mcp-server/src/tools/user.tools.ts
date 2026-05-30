import { getApiClient, extractData } from "../auth/api-client.js";
import type { McpTool } from "./index.js";

export const userTools: McpTool[] = [
  {
    name: "list_users",
    description:
      "Danh sách nhân viên trong hệ thống. Dùng để lấy ID nhân viên khi cần assign task hoặc dự án. " +
      "Dùng khi: 'Danh sách nhân viên', 'ID của anh Minh là gì?', 'Staff nào đang active?'.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Tìm theo tên/email" },
        role: {
          type: "string",
          enum: ["ADMIN", "MANAGER", "STAFF"],
          description: "Lọc theo role",
        },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        limit: 50,
        isActive: true,
      };
      if (args["search"]) params["search"] = args["search"];
      if (args["role"]) params["role"] = args["role"];

      const res = await client.get<unknown>("/users", { params });
      const items = extractData<UserItem[]>(res.data);

      if (!items.length) {
        return "✅ Không tìm thấy nhân viên nào.";
      }

      const lines = items.map(
        (u) => `• ${u.name} (${u.role ?? "STAFF"}) — ${u.email} — ID: ${u.id}`
      );

      return `👥 Danh sách nhân viên (${items.length} người):\n\n${lines.join("\n")}`;
    },
  },
];

interface UserItem {
  id: string;
  name: string;
  email: string;
  role?: string;
}
