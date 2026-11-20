import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatDate, formatVND } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

interface SalesInvoiceItem {
  id: string;
  series: string;
  number: string;
  date: string;
  amountExVat: number;
  vatAmount: number;
  totalAmount: number;
  status: string;
  notes?: string | null;
  project?: { id: string; code: string; name: string } | null;
}

interface CostItem {
  id: string;
  projectId: string | null;
  project?: { id: string; code: string; name: string } | null;
  group: string;
  description: string;
  amount: number;
  vatAmount?: number | null;
  invoiceNo?: string | null;
  invoiceDate: string;
}

interface AllocationLine {
  projectCode: string;
  projectName: string;
  basisValue: number;
  share: number;
  amount: number;
}

interface AllocationResult {
  mode: "PREVIEW" | "CONFIRM";
  persisted: boolean;
  idempotent?: boolean;
  totalAmount?: number;
  allocatedTotal?: number;
  lines?: AllocationLine[];
  warnings?: string[];
  allocation?: { id: string; totalAmount: number; lines: AllocationLine[] };
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  ISSUED: "Đang hiệu lực",
  CANCELLED: "Đã hủy",
  REPLACED: "Đã thay thế"
};

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function copy(args: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (args[key] !== undefined && args[key] !== null && args[key] !== "") out[key] = args[key];
  }
  return out;
}

function projectLabel(project?: { code: string; name: string } | null) {
  return project ? `${project.code} - ${project.name}` : "Chưa gắn dự án";
}

function formatLines(lines: AllocationLine[]) {
  return lines
    .map(
      (line) =>
        `  • ${line.projectCode} ${line.projectName}: **${formatVND(line.amount)}** ` +
        `(tỷ lệ ${(line.share * 100).toFixed(2)}%, cơ sở ${formatVND(line.basisValue)})`
    )
    .join("\n");
}

export const projectFinanceTools: McpTool[] = [
  {
    name: "link_sales_invoice_to_project",
    description:
      "Liên kết hóa đơn bán ra (đầu ra) với dự án (và hợp đồng nếu có). Chống trùng (ký hiệu, số) cho hóa đơn chưa hủy → lỗi 409 kèm ID hóa đơn cũ. " +
      "Chặn khi ngày hóa đơn nằm trong kỳ đã khóa sổ. Dùng khi: 'Gắn hóa đơn C26TAA-123 vào dự án X'.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID dự án (bắt buộc)" },
        contractId: { type: "string", description: "Tuỳ chọn. ID hợp đồng của chính dự án đó" },
        series: { type: "string", description: "Ký hiệu hóa đơn, VD C26TAA" },
        number: { type: "string", description: "Số hóa đơn" },
        date: { type: "string", description: "Ngày hóa đơn (ISO date)" },
        buyerTaxCode: { type: "string", description: "Tuỳ chọn. MST người mua" },
        amountExVat: { type: "number", description: "Tiền hàng chưa VAT (VND, số nguyên)" },
        vatAmount: { type: "number", description: "Tiền VAT (VND). Mặc định 0" },
        notes: { type: "string", description: "Ghi chú" }
      },
      required: ["projectId", "series", "number", "date", "amountExVat"]
    },
    async handler(args) {
      const client = getApiClient();
      const payload = copy(args, ["projectId", "contractId", "series", "number", "date", "buyerTaxCode", "amountExVat", "vatAmount", "notes"]);
      const res = await client.post<unknown>("/sales-invoices", payload);
      const inv = extractData<SalesInvoiceItem>(res.data);
      return (
        `✅ Đã liên kết hóa đơn bán ra **${inv.series}-${inv.number}** (${formatDate(inv.date)})\n` +
        `Dự án: ${projectLabel(inv.project)} | Chưa VAT: ${formatVND(inv.amountExVat)} | VAT: ${formatVND(inv.vatAmount)} | Tổng: ${formatVND(inv.totalAmount)}\n` +
        `ID: \`${inv.id}\``
      );
    }
  },

  {
    name: "list_sales_invoices",
    description:
      "Danh sách hóa đơn bán ra, lọc theo dự án, hợp đồng, trạng thái (ISSUED/CANCELLED/REPLACED), ký hiệu, số, khoảng ngày. Có phân trang.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Lọc theo dự án" },
        contractId: { type: "string", description: "Lọc theo hợp đồng" },
        status: { type: "string", enum: ["ISSUED", "CANCELLED", "REPLACED"], description: "Lọc theo trạng thái" },
        series: { type: "string", description: "Ký hiệu hóa đơn (chứa)" },
        number: { type: "string", description: "Số hóa đơn (chứa)" },
        dateFrom: { type: "string", description: "Từ ngày (ISO date)" },
        dateTo: { type: "string", description: "Đến ngày (ISO date)" },
        page: { type: "number", description: "Trang, mặc định 1" },
        limit: { type: "number", description: "Số dòng/trang, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params = { ...copy(args, ["projectId", "contractId", "status", "series", "number", "dateFrom", "dateTo", "page"]), limit: args["limit"] ?? 10 };
      const res = await client.get<unknown>("/sales-invoices", { params });
      const items = extractData<SalesInvoiceItem[]>(res.data);
      const meta = extractMeta(res.data);
      if (!items.length) return "📭 Không có hóa đơn bán ra nào khớp bộ lọc.";
      const rows = items.map(
        (inv, i) =>
          `${i + 1}. 🧾 **${inv.series}-${inv.number}** | ${formatDate(inv.date)} | ${INVOICE_STATUS_LABEL[inv.status] ?? inv.status}\n` +
          `   Dự án: ${projectLabel(inv.project)} | Chưa VAT: ${formatVND(inv.amountExVat)} | VAT: ${formatVND(inv.vatAmount)} | ID: \`${inv.id}\``
      );
      return `🧾 **Hóa đơn bán ra** (${meta?.total ?? items.length} tổng, trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1}):\n\n${rows.join("\n\n")}`;
    }
  },

  {
    name: "cancel_sales_invoice",
    description:
      "Hủy hóa đơn bán ra (lý do bắt buộc ≥ 5 ký tự). Nếu có replacedByInvoiceId thì đánh dấu REPLACED và ghi liên kết sang hóa đơn thay thế. " +
      "Chặn khi kỳ đã khóa sổ, hoặc khi dự án đã DELIVERED và đây là hóa đơn cuối cùng.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "ID hóa đơn bán ra" },
        reason: { type: "string", description: "Lý do hủy (≥ 5 ký tự)" },
        replacedByInvoiceId: { type: "string", description: "Tuỳ chọn. ID hóa đơn thay thế (đã liên kết trước)" }
      },
      required: ["invoiceId", "reason"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(
        `/sales-invoices/${args["invoiceId"] as string}/cancel`,
        copy(args, ["reason", "replacedByInvoiceId"])
      );
      const inv = extractData<SalesInvoiceItem>(res.data);
      return `✅ Hóa đơn **${inv.series}-${inv.number}** → ${INVOICE_STATUS_LABEL[inv.status] ?? inv.status}\n${inv.notes ?? ""}`.trim();
    }
  },

  {
    name: "recognize_project_cost",
    description:
      "Ghi nhận giá vốn dự án (DELIVER → trạng thái DELIVERED, đóng băng chi phí) hoặc mở lại (REOPEN). " +
      "DELIVER cần ít nhất 1 hóa đơn bán ra còn hiệu lực (ADMIN có thể ép với overrideNoInvoice + lý do). " +
      "REOPEN cần quyền inventory.approve, lý do ≥ 5 ký tự và kỳ ghi nhận chưa khóa. Khi DELIVERED: không thêm/sửa/xóa chi phí dự án, không hủy phiếu xuất của dự án.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID dự án" },
        action: { type: "string", enum: ["DELIVER", "REOPEN"], description: "DELIVER = ghi nhận giá vốn; REOPEN = mở lại" },
        reason: { type: "string", description: "Lý do (bắt buộc với REOPEN và với DELIVER không hóa đơn)" },
        overrideNoInvoice: { type: "boolean", description: "Chỉ ADMIN: cho DELIVER khi chưa có hóa đơn bán ra" },
        recognizedAt: { type: "string", description: "Tuỳ chọn. Ngày ghi nhận (ISO), mặc định hôm nay" }
      },
      required: ["projectId", "action"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(
        `/projects/${args["projectId"] as string}/recognize-cost`,
        copy(args, ["action", "reason", "overrideNoInvoice", "recognizedAt"])
      );
      const out = extractData<{ costRecognitionStatus: string; costRecognizedAt: string | null; changed: boolean }>(res.data);
      const label = out.costRecognitionStatus === "DELIVERED" ? "Đã bàn giao – giá vốn đã ghi nhận" : "Đang thực hiện";
      return (
        `${out.changed ? "✅" : "ℹ️"} Dự án: **${label}**` +
        (out.costRecognizedAt ? ` (ngày ${formatDate(out.costRecognizedAt)})` : "") +
        (out.changed ? "" : "\nKhông có thay đổi (đã ở trạng thái này).")
      );
    }
  },

  {
    name: "add_project_cost",
    description:
      "Thêm chi phí trực tiếp (không qua kho: đi lại, vận chuyển, thuê ngoài…) cho dự án. Bỏ trống projectId = chi phí chưa gắn dự án (gắn sau bằng assign_project_cost). " +
      "category là chuỗi tự do (VD 'Đi lại', 'Grab', 'Vận chuyển') được hệ thống ánh xạ vào nhóm: MECHANICAL, ELECTRICAL, VISION, SOFTWARE, LABOR, OUTSOURCE, SHIPPING, TRAVEL, OTHER. " +
      "Bị chặn khi dự án đã DELIVERED hoặc ngày hóa đơn trong kỳ khóa sổ.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Tuỳ chọn. ID dự án; bỏ trống = chưa gắn dự án" },
        category: { type: "string", description: "Nhóm chi phí (chuỗi tự do hoặc tên nhóm)" },
        description: { type: "string", description: "Nội dung chi phí" },
        amount: { type: "number", description: "Số tiền chưa VAT (VND)" },
        vatRate: { type: "number", description: "Tuỳ chọn. Thuế suất %" },
        vatAmount: { type: "number", description: "Tuỳ chọn. Tiền VAT (VND)" },
        invoiceDate: { type: "string", description: "Ngày hóa đơn/chứng từ (ISO date)" },
        invoiceNo: { type: "string", description: "Tuỳ chọn. Số hóa đơn dạng tự do" },
        invoiceSeries: { type: "string", description: "Tuỳ chọn. Ký hiệu hóa đơn" },
        invoiceNumber: { type: "string", description: "Tuỳ chọn. Số hóa đơn" },
        sellerTaxCode: { type: "string", description: "Tuỳ chọn. MST người bán" },
        supplierId: { type: "string", description: "Tuỳ chọn. ID nhà cung cấp" },
        notes: { type: "string", description: "Ghi chú" }
      },
      required: ["category", "description", "amount", "invoiceDate"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(
        "/project-finance/costs",
        copy(args, ["projectId", "category", "description", "amount", "vatRate", "vatAmount", "invoiceDate", "invoiceNo", "invoiceSeries", "invoiceNumber", "sellerTaxCode", "supplierId", "notes"])
      );
      const cost = extractData<CostItem>(res.data);
      return (
        `✅ Đã thêm chi phí **${formatVND(cost.amount)}** (nhóm ${cost.group}) — ${cost.description}\n` +
        `Dự án: ${projectLabel(cost.project)} | ID: \`${cost.id}\``
      );
    }
  },

  {
    name: "list_project_costs",
    description:
      "Danh sách chi phí trực tiếp (ProjectCost), lọc theo dự án, chỉ chi phí chưa gắn dự án (unassignedOnly), nhóm, khoảng ngày. Có phân trang.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Lọc theo dự án" },
        unassignedOnly: { type: "boolean", description: "Chỉ chi phí chưa gắn dự án" },
        group: { type: "string", description: "Nhóm chi phí (tên nhóm hoặc chuỗi tự do)" },
        dateFrom: { type: "string", description: "Từ ngày (ISO date)" },
        dateTo: { type: "string", description: "Đến ngày (ISO date)" },
        page: { type: "number", description: "Trang, mặc định 1" },
        limit: { type: "number", description: "Số dòng/trang, mặc định 10" }
      },
      required: []
    },
    async handler(args) {
      const client = getApiClient();
      const params = { ...copy(args, ["projectId", "unassignedOnly", "group", "dateFrom", "dateTo", "page"]), limit: args["limit"] ?? 10 };
      const res = await client.get<unknown>("/project-finance/costs", { params });
      const items = extractData<CostItem[]>(res.data);
      const meta = extractMeta(res.data);
      if (!items.length) return "📭 Không có chi phí nào khớp bộ lọc.";
      const rows = items.map(
        (c, i) =>
          `${i + 1}. 💸 **${formatVND(c.amount)}** | ${c.group} | ${formatDate(c.invoiceDate)} | ${c.description}\n` +
          `   Dự án: ${projectLabel(c.project)}${c.invoiceNo ? ` | HĐ: ${c.invoiceNo}` : ""} | ID: \`${c.id}\``
      );
      return `💸 **Chi phí dự án** (${meta?.total ?? items.length} tổng, trang ${meta?.page ?? 1}/${meta?.totalPages ?? 1}):\n\n${rows.join("\n\n")}`;
    }
  },

  {
    name: "assign_project_cost",
    description:
      "Gắn chi phí (đang chưa gắn dự án) vào một dự án. Chặn khi dự án đã DELIVERED, kỳ khóa sổ, hoặc chi phí thuộc đợt phân bổ.",
    inputSchema: {
      type: "object",
      properties: {
        costId: { type: "string", description: "ID chi phí từ list_project_costs" },
        projectId: { type: "string", description: "ID dự án đích" }
      },
      required: ["costId", "projectId"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.patch<unknown>(`/project-finance/costs/${args["costId"] as string}/assign`, {
        projectId: args["projectId"]
      });
      const cost = extractData<CostItem>(res.data);
      return `✅ Chi phí **${formatVND(cost.amount)}** (${cost.description}) đã gắn vào dự án ${projectLabel(cost.project)}`;
    }
  },

  {
    name: "allocate_common_materials",
    description:
      "Phân bổ vật tư dùng chung (accountingClass = CONSUMABLE_COMMON) đã xuất kho trong kỳ cho các dự án đang thực hiện theo cơ sở REVENUE (hóa đơn bán ra trong kỳ), DIRECT_COST (giá vốn trực tiếp trong kỳ) hoặc MANUAL (manualShares). " +
      "Số tiền là số nguyên VND, các dòng cộng đúng bằng tổng (làm tròn phần dư lớn nhất). " +
      "mode=PREVIEW chỉ tính, không ghi gì; mode=CONFIRM (cần quyền inventory.approve, kỳ chưa khóa) ghi đợt phân bổ + chi phí từng dự án, chạy lại cùng kỳ trả về đợt cũ.",
    inputSchema: {
      type: "object",
      properties: {
        periodFrom: { type: "string", description: "Đầu kỳ (ISO date)" },
        periodTo: { type: "string", description: "Cuối kỳ (ISO date, gồm cả ngày này)" },
        mode: { type: "string", enum: ["PREVIEW", "CONFIRM"], description: "Mặc định PREVIEW" },
        basis: { type: "string", enum: ["REVENUE", "DIRECT_COST", "MANUAL"], description: "Cơ sở phân bổ, mặc định REVENUE" },
        manualShares: {
          type: "array",
          description: "Chỉ khi basis=MANUAL: [{projectId, share}] (share > 0, tỷ trọng tương đối)",
          items: {
            type: "object",
            properties: { projectId: { type: "string" }, share: { type: "number" } },
            required: ["projectId", "share"]
          }
        }
      },
      required: ["periodFrom", "periodTo"]
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.post<unknown>(
        "/project-finance/common-allocations",
        copy(args, ["periodFrom", "periodTo", "mode", "basis", "manualShares"])
      );
      const out = extractData<AllocationResult>(res.data);
      if (out.mode === "PREVIEW") {
        const warnings = out.warnings?.length ? `\n⚠️ ${out.warnings.join("\n⚠️ ")}` : "";
        if (!out.lines?.length) return `📭 Không có vật tư dùng chung cần phân bổ trong kỳ (tổng ${formatVND(out.totalAmount ?? 0)}).${warnings}`;
        return (
          `🔎 **Xem trước phân bổ vật tư dùng chung** (chưa ghi dữ liệu)\n` +
          `Tổng: **${formatVND(out.totalAmount ?? 0)}** = Σ các dòng ${formatVND(out.allocatedTotal ?? 0)}\n${formatLines(out.lines)}${warnings}`
        );
      }
      const alloc = out.allocation;
      return (
        `${out.idempotent ? "ℹ️ Kỳ này đã được phân bổ trước đó (không ghi thêm)." : "✅ Đã xác nhận phân bổ vật tư dùng chung."}\n` +
        (alloc ? `ID: \`${alloc.id}\` | Tổng: **${formatVND(alloc.totalAmount)}**\n${formatLines(alloc.lines)}` : "")
      );
    }
  }
];
