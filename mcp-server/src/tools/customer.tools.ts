import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { tokenManager } from "../auth/token-manager.js";
import {
  formatVND,
  formatDate,
  formatRelative,
  stageLabel,
  activityTypeLabel,
  truncate,
} from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

export const customerTools: McpTool[] = [
  {
    name: "search_customers",
    description:
      "Tìm kiếm khách hàng trong AHSO CRM theo tên, ngành nghề hoặc từ khoá. " +
      "Dùng khi: 'Tìm khách Vinamilk', 'Khách ngành thực phẩm', 'Danh sách khách hàng hiện tại'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khoá tìm kiếm — tên, mã KH, email" },
        industry: { type: "string", description: "Ngành nghề (tuỳ chọn)" },
        limit: { type: "number", description: "Số kết quả tối đa (mặc định 10)" },
      },
      required: [],
    },
    async handler(args) {
      const client = getApiClient();
      const params: Record<string, unknown> = {
        limit: args["limit"] ?? 10,
        page: 1,
      };
      if (args["query"]) params["search"] = args["query"];
      if (args["industry"]) params["industry"] = args["industry"];

      const res = await client.get<unknown>("/customers", { params });
      const items = extractData<CustomerListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) {
        return args["query"]
          ? `❌ Không tìm thấy khách hàng nào với từ khoá "${args["query"] as string}".`
          : "📋 Chưa có khách hàng nào trong hệ thống.";
      }

      const lines = items.map(
        (c, i) =>
          `${i + 1}. 🏢 **${c.name}** (${c.code ?? "—"})\n` +
          `   Ngành: ${c.industry ?? "—"} | Trạng thái: ${c.status ?? "—"} | ID: ${c.id}`
      );

      const total = meta?.total ?? items.length;
      const header =
        total > items.length
          ? `🔍 Tìm thấy ${total} khách hàng (hiển thị ${items.length}):\n\n`
          : `🏢 ${total} khách hàng:\n\n`;

      return header + lines.join("\n\n");
    },
  },

  {
    name: "get_customer_detail",
    description:
      "Xem thông tin chi tiết một khách hàng: liên hệ, dự án, thống kê doanh thu. " +
      "Dùng khi: 'Thông tin Thaco Auto', 'Xem chi tiết khách hàng [ID]'.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID khách hàng (lấy từ search_customers)" },
      },
      required: ["customerId"],
    },
    async handler(args) {
      const client = getApiClient();
      const id = args["customerId"] as string;

      const [detailRes, statsRes] = await Promise.allSettled([
        client.get<unknown>(`/customers/${id}`),
        client.get<unknown>(`/customers/${id}/stats`),
      ]);

      if (detailRes.status === "rejected") {
        return `❌ Không tìm thấy khách hàng ID: ${id}`;
      }

      const c = extractData<CustomerDetail>(detailRes.value.data);
      const stats =
        statsRes.status === "fulfilled"
          ? extractData<CustomerStats>(statsRes.value.data)
          : null;

      const contacts = c.contacts
        ?.map((ct) => `  • ${ct.name}${ct.title ? ` (${ct.title})` : ""} — ${ct.phone ?? ct.email ?? "—"}`)
        .join("\n");

      const projects = c.projects
        ?.slice(0, 5)
        .map((p) => `  • ${p.code} — ${p.name} [${stageLabel(p.status)}]`)
        .join("\n");

      let out = `🏢 **${c.name}**`;
      if (c.shortName) out += ` (${c.shortName})`;
      out += `\n📋 Mã: ${c.code ?? "—"} | Trạng thái: ${c.status ?? "—"}`;
      out += `\n🏭 Ngành: ${c.industry ?? "—"} | MST: ${c.taxCode ?? "—"}`;
      if (c.address) out += `\n📍 ${c.address}`;
      if (c.phone) out += `\n📞 ${c.phone}`;
      if (c.email) out += `\n✉️ ${c.email}`;
      if (c.website) out += `\n🌐 ${c.website}`;

      if (contacts) out += `\n\n👥 **Liên hệ:**\n${contacts}`;

      if (stats) {
        out += `\n\n📊 **Thống kê:**`;
        out += `\n  Dự án: ${stats.projectCount ?? 0} | Báo giá: ${stats.quoteCount ?? 0} | Hợp đồng: ${stats.contractCount ?? 0}`;
        if (stats.totalContractValue) out += `\n  💰 Tổng HĐ: ${formatVND(stats.totalContractValue)}`;
      }

      if (projects) out += `\n\n📁 **Dự án gần đây:**\n${projects}`;
      if (c.notes) out += `\n\n📝 Ghi chú: ${truncate(c.notes)}`;

      return out;
    },
  },

  {
    name: "create_customer",
    description:
      "Tạo khách hàng mới trong CRM. " +
      "Dùng khi: 'Tạo khách hàng mới: Công ty ABC, ngành thép, SĐT 0901234567'.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tên đầy đủ công ty (bắt buộc)" },
        industry: { type: "string", description: "Ngành nghề" },
        phone: { type: "string", description: "Số điện thoại" },
        email: { type: "string", description: "Email liên hệ" },
        address: { type: "string", description: "Địa chỉ" },
        taxCode: { type: "string", description: "Mã số thuế" },
        notes: { type: "string", description: "Ghi chú thêm" },
        assignedToId: { type: "string", description: "ID người phụ trách (mặc định: người đang dùng)" },
      },
      required: ["name"],
    },
    async handler(args) {
      const client = getApiClient();
      // assignedToId là required bởi backend — mặc định là user hiện tại
      // Đảm bảo token đã được lấy trước khi đọc userId từ JWT
      await tokenManager.getValidAccessToken();
      const assignedToId = (args["assignedToId"] as string | undefined)
        ?? tokenManager.getCurrentUserId()
        ?? "";
      const payload: Record<string, unknown> = { name: args["name"], assignedToId };
      if (args["industry"]) payload["industry"] = args["industry"];
      if (args["phone"]) payload["phone"] = args["phone"];
      if (args["email"]) payload["email"] = args["email"];
      if (args["address"]) payload["address"] = args["address"];
      if (args["taxCode"]) payload["taxCode"] = args["taxCode"];
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.post<unknown>("/customers", payload);
      const c = extractData<{ id: string; name: string; code: string }>(res.data);

      return (
        `✅ Đã tạo khách hàng mới:\n` +
        `🏢 **${c.name}** — Mã: ${c.code}\n` +
        `ID: ${c.id}\n\n` +
        `💡 Dùng get_customer_detail để xem chi tiết, hoặc create_project để tạo deal mới cho khách này.`
      );
    },
  },

  {
    name: "add_activity_note",
    description:
      "Ghi chú hoạt động với khách hàng (gọi điện, gặp mặt, email, ghi chú). " +
      "Dùng khi: 'Ghi chú vừa gặp anh Minh bên Sabeco', 'Log cuộc gọi với Vinamilk hôm nay'.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID khách hàng" },
        content: { type: "string", description: "Nội dung ghi chú" },
        type: {
          type: "string",
          enum: ["call", "meeting", "email", "note"],
          description: "Loại hoạt động: call|meeting|email|note",
        },
        title: { type: "string", description: "Tiêu đề tóm tắt (tuỳ chọn)" },
      },
      required: ["customerId", "content", "type"],
    },
    async handler(args) {
      const client = getApiClient();
      const typeMap: Record<string, string> = {
        call: "CALL",
        meeting: "MEETING",
        email: "EMAIL",
        note: "NOTE",
      };
      const activityType = typeMap[args["type"] as string] ?? "NOTE";
      const content = args["content"] as string;
      const title = (args["title"] as string) || content.slice(0, 60);

      const res = await client.post<unknown>("/activities", {
        type: activityType,
        title,
        content,
        customerId: args["customerId"],
      });

      const a = extractData<{ id: string; type: string; title: string; createdAt: string }>(res.data);
      return (
        `✅ Đã ghi ${activityTypeLabel(a.type)}:\n` +
        `📝 "${a.title}"\n` +
        `📅 ${formatDate(a.createdAt)}`
      );
    },
  },

  {
    name: "update_customer",
    description:
      "Cập nhật thông tin khách hàng hiện có. " +
      "Dùng khi: 'Cập nhật email KH Sabeco', 'Đổi trạng thái Vinamilk sang Không hoạt động'.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID khách hàng" },
        name: { type: "string", description: "Tên công ty" },
        phone: { type: "string", description: "Số điện thoại" },
        email: { type: "string", description: "Email" },
        address: { type: "string", description: "Địa chỉ" },
        taxCode: { type: "string", description: "Mã số thuế" },
        industry: { type: "string", description: "Ngành nghề" },
        notes: { type: "string", description: "Ghi chú" },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE", "PROSPECT"],
          description: "Trạng thái hoạt động",
        },
      },
      required: ["customerId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      const fields = ["name", "phone", "email", "address", "taxCode", "industry", "notes", "status"];
      for (const field of fields) {
        if (args[field] !== undefined && args[field] !== null) {
          payload[field] = args[field];
        }
      }

      const res = await client.patch<unknown>(`/customers/${args["customerId"] as string}`, payload);
      const c = extractData<{ id: string; name: string; code: string }>(res.data);

      return `✅ Đã cập nhật ${c.name} — Mã: ${c.code}`;
    },
  },

  {
    name: "add_contact",
    description:
      "Thêm người liên hệ mới vào khách hàng. " +
      "Dùng khi: 'Thêm liên hệ mới: Nguyễn Văn A, GĐ Mua hàng, Sabeco'.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "ID khách hàng" },
        name: { type: "string", description: "Tên người liên hệ" },
        title: { type: "string", description: "Chức vụ" },
        phone: { type: "string", description: "Số điện thoại" },
        email: { type: "string", description: "Email" },
        isPrimary: { type: "boolean", description: "Là liên hệ chính (mặc định false)" },
      },
      required: ["customerId", "name"],
    },
    async handler(args) {
      const client = getApiClient();
      const customerId = args["customerId"] as string;
      const payload: Record<string, unknown> = { name: args["name"] };
      if (args["title"]) payload["title"] = args["title"];
      if (args["phone"]) payload["phone"] = args["phone"];
      if (args["email"]) payload["email"] = args["email"];
      if (args["isPrimary"] !== undefined) payload["isPrimary"] = args["isPrimary"];

      // Endpoint: POST /customers/:id/contacts (không phải /contacts)
      const res = await client.post<unknown>(`/customers/${customerId}/contacts`, payload);
      const c = extractData<NewContact>(res.data);

      return `✅ Đã thêm liên hệ ${c.name}${c.title ? ` (${c.title})` : ""} vào KH ${c.customer?.name ?? ""}`;
    },
  },
];

// Interfaces

interface CustomerListItem {
  id: string;
  name: string;
  code?: string;
  industry?: string;
  status?: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  shortName?: string;
  code?: string;
  status?: string;
  industry?: string;
  taxCode?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  contacts?: Array<{ name: string; title?: string; phone?: string; email?: string }>;
  projects?: Array<{ code: string; name: string; status: string }>;
}

interface CustomerStats {
  projectCount?: number;
  quoteCount?: number;
  contractCount?: number;
  totalContractValue?: number;
}

interface NewContact {
  id: string;
  name: string;
  title?: string;
  customerId: string;
  customer?: { name: string };
}
