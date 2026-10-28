import { getApiClient, extractData, extractMeta } from "../auth/api-client.js";
import { formatVND, formatDate, truncate } from "../formatters/common.formatter.js";
import type { McpTool } from "./index.js";

function rateText(rate: number | string): string {
  return `${Number(rate)}%`;
}

function rateSuffix(rate: number | string | null | undefined): string {
  if (rate === undefined) return "";
  return rate === null ? " [KCT]" : ` [VAT ${rateText(rate)}]`;
}

export type TaxResolution = { ok: true; value: number | null | undefined } | { ok: false; error: string };

/** Đổi VAT dạng phân số (0.08) sang phần trăm (8). Trả lỗi tiếng Việt nếu ngoài 0..1. */
export function vatFractionToPercent(v: unknown, label = "vatRate"): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return { ok: false, error: `${label} phải là số (phân số, vd 0.08 cho 8%).` };
  }
  if (v < 0 || v > 1) {
    return { ok: false, error: `${label}=${v} không hợp lệ: ${label} là phân số trong khoảng 0..1 — dùng 0.08 cho 8%, 0.1 cho 10% (hoặc dùng taxRate=8 theo phần trăm).` };
  }
  return { ok: true, value: Math.round(v * 100 * 100) / 100 };
}

/**
 * Xác định VAT (%) của một dòng.
 * taxExempt=true -> null (KCT); vatRate (phân số) -> *100; taxRate (%); bỏ trống -> undefined (backend dùng mặc định của báo giá).
 */
export function resolveItemTax(input: { taxRate?: unknown; vatRate?: unknown; taxExempt?: unknown }): TaxResolution {
  const { taxRate, vatRate, taxExempt } = input;
  const hasVat = vatRate !== undefined && vatRate !== null;
  const hasPct = taxRate !== undefined && taxRate !== null;
  if (taxExempt === true) {
    if (hasVat || hasPct) {
      return { ok: false, error: "taxExempt=true (KCT) không dùng cùng taxRate/vatRate — chỉ chọn một." };
    }
    return { ok: true, value: null };
  }
  let fromVat: number | undefined;
  if (hasVat) {
    const r = vatFractionToPercent(vatRate);
    if (!r.ok) return r;
    fromVat = r.value;
  }
  if (hasPct) {
    if (typeof taxRate !== "number" || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return { ok: false, error: `taxRate=${String(taxRate)} không hợp lệ: phải là phần trăm 0..100 (vd 8).` };
    }
    if (fromVat !== undefined && fromVat !== taxRate) {
      return { ok: false, error: `taxRate (${taxRate}%) và vatRate (${vatRate} = ${fromVat}%) mâu thuẫn — chỉ truyền một trong hai.` };
    }
    return { ok: true, value: taxRate };
  }
  if (fromVat !== undefined) return { ok: true, value: fromVat };
  if (taxRate === null) return { ok: true, value: null }; // taxRate:null = KCT (hợp đồng API cũ)
  return { ok: true, value: undefined };
}

function taxLabel(rate: number | string | null | undefined): string {
  return rate == null ? "KCT" : rateText(rate);
}

type TaxGroup = { rate: number | string | null; base: number | string; tax: number | string };

function totalsBlock(q: { subtotal?: number | string; taxAmount?: number | string; total?: number | string; taxBreakdown?: TaxGroup[] }): string {
  let out = "";
  const groups = q.taxBreakdown ?? [];
  const vatBase = groups.filter((g) => g.rate != null).reduce((a, g) => a + Number(g.base), 0);
  if (q.subtotal != null) out += `\n💵 Tạm tính (chưa VAT): ${formatVND(q.subtotal)}`;
  if (groups.length) {
    out += `\n🧾 Cơ sở tính VAT: ${formatVND(vatBase)}`;
    for (const g of groups) {
      const label = g.rate == null ? "Không chịu thuế (KCT)" : `VAT ${rateText(g.rate)}`;
      out += `\n    - ${label}: ${formatVND(g.base)} → thuế ${formatVND(g.tax)}`;
    }
  }
  if (q.taxAmount != null) out += `\n🧾 Tiền VAT: ${formatVND(q.taxAmount)}`;
  if (q.total != null) out += `\n💰 **Tổng cộng: ${formatVND(q.total)}**`;
  return out;
}

const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "📝 Bản nháp",
  SENT: "📤 Đã gửi",
  ACCEPTED: "✅ Chấp nhận",
  REJECTED: "❌ Từ chối",
  EXPIRED: "⏰ Hết hạn",
};

function listVatDetail(q: { taxBreakdown?: TaxGroup[] }): string {
  const g = q.taxBreakdown ?? [];
  if (!g.length) return "";
  const base = g.filter((x) => x.rate != null).reduce((a, x) => a + Number(x.base), 0);
  return ` (cơ sở ${formatVND(base)}; ${g.map((x) => taxLabel(x.rate)).join(", ")})`;
}

export const quoteTools: McpTool[] = [
  {
    name: "list_quotes",
    description:
      "Danh sách báo giá theo trạng thái hoặc khách hàng. " +
      "Dùng khi: 'Báo giá nào đang chờ phản hồi?', 'Báo giá của dự án X?'",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
          description: "Lọc theo trạng thái (tuỳ chọn)",
        },
        customerId: { type: "string", description: "ID khách hàng (tuỳ chọn)" },
        projectId: { type: "string", description: "ID dự án (tuỳ chọn)" },
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
      if (args["status"]) params["status"] = args["status"];
      if (args["customerId"]) params["customerId"] = args["customerId"];
      if (args["projectId"]) params["projectId"] = args["projectId"];

      const res = await client.get<unknown>("/quotes", { params });
      const items = extractData<QuoteListItem[]>(res.data);
      const meta = extractMeta(res.data);

      if (!items.length) return "📭 Không tìm thấy báo giá nào.";

      const lines = items.map((q) => {
        const status = QUOTE_STATUS_LABEL[q.status ?? ""] ?? q.status ?? "—";
        return (
          `  • **${q.quoteNo}** ${status} | ID: \`${q.id}\`\n` +
          `    KH: ${q.project?.customer?.name ?? "—"} | ${formatDate(q.createdAt)}\n` +
          `    Tạm tính ${formatVND(q.subtotal)} | VAT ${formatVND(q.taxAmount)}${listVatDetail(q)} | **Tổng ${formatVND(q.total)}**`
        );
      });

      return (
        `📄 **Báo giá** (${meta?.total ?? items.length} tổng):\n\n` +
        lines.join("\n")
      );
    },
  },

  {
    name: "get_quote_detail",
    description:
      "Xem chi tiết một báo giá: hạng mục, tổng tiền, trạng thái. " +
      "Dùng khi: 'Chi tiết báo giá BG-2026-001', 'Báo giá X có những gì?'",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá (lấy từ list_quotes)" },
      },
      required: ["quoteId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.get<unknown>(`/quotes/${args["quoteId"] as string}`);
      const q = extractData<QuoteDetail>(res.data);

      const status = QUOTE_STATUS_LABEL[q.status ?? ""] ?? q.status ?? "—";
      let out = `📄 **Báo giá ${q.quoteNo}** — ${status}\n`;
      out += `🏢 Khách hàng: ${q.project?.customer?.name ?? "—"}\n`;
      if (q.project?.name) out += `📁 Dự án: ${q.project.name}\n`;
      out += `📅 Ngày tạo: ${formatDate(q.createdAt)}`;
      if (q.sentAt) out += ` | Đã gửi: ${formatDate(q.sentAt)}`;
      out += totalsBlock(q);
      if (!q.taxBreakdown?.length && q.taxRate != null) out += `\n(VAT mặc định ${rateText(q.taxRate)})`;
      out += "\n";

      if (q.items?.length) {
        out += `\n📋 **Hạng mục (${q.items.length} dòng):**\n`;
        out += q.items
          .slice(0, 10)
          .map(
            (item, i) =>
              `  ${i + 1}. ${item.name} — ${item.quantity} ${item.unit ?? ""} × ${formatVND(item.unitPrice)} = ${formatVND(item.total)}${rateSuffix(item.taxRate)}`
          )
          .join("\n");
        if (q.items.length > 10) out += `\n  ... và ${q.items.length - 10} dòng khác`;
      }

      if (q.notes) out += `\n\n📝 Ghi chú: ${truncate(q.notes)}`;

      return out;
    },
  },

  {
    name: "add_quote_items",
    description:
      "Thêm hoặc thay thế danh sách hạng mục trong báo giá (chỉ DRAFT). " +
      "Dùng khi: 'Thêm 3 thiết bị vào BG-2026-012', 'Cập nhật hạng mục báo giá AHSO-331'. " +
      "Lưu ý: thao tác này THAY THẾ toàn bộ items — hãy liệt kê đủ tất cả hạng mục muốn giữ lại.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá (phải ở trạng thái DRAFT)" },
        items: {
          type: "array",
          description: "Danh sách hạng mục (tối đa 50)",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Tên hạng mục (bắt buộc)" },
              quantity: { type: "number", description: "Số lượng (bắt buộc, > 0)" },
              unitPrice: { type: "number", description: "Đơn giá VND (bắt buộc, >= 0)" },
              unit: { type: "string", description: "Đơn vị: cái, bộ, m, kg... (tuỳ chọn)" },
              description: { type: "string", description: "Mô tả chi tiết (tuỳ chọn)" },
              taxRate: {
                type: ["number", "null"],
                minimum: 0,
                maximum: 100,
                description: "VAT riêng của dòng, PHẦN TRĂM 0-100 (vd 8, 10); null = KCT; bỏ trống = lấy mức VAT mặc định của báo giá",
              },
              vatRate: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "VAT dạng PHÂN SỐ 0..1 (0.08 = 8%, 0.1 = 10%). Không dùng chung với taxRate/taxExempt",
              },
              taxExempt: {
                type: "boolean",
                description: "true = KCT (không chịu thuế, taxRate null). Không dùng chung với taxRate/vatRate",
              },
            },
            required: ["name", "quantity", "unitPrice"],
          },
        },
      },
      required: ["quoteId", "items"],
    },
    async handler(args) {
      const client = getApiClient();
      const quoteId = args["quoteId"] as string;

      // Lấy projectId và validate trạng thái DRAFT
      const quoteRes = await client.get<unknown>(`/quotes/${quoteId}`);
      const quote = extractData<QuoteDetail>(quoteRes.data);

      if (quote.status && !["DRAFT", "REJECTED"].includes(quote.status)) {
        return `❌ Báo giá **${quote.quoteNo}** đang ở trạng thái "${quote.status}" — chỉ có thể sửa khi DRAFT hoặc bị từ chối.`;
      }

      const projectId = quote.project?.id;
      if (!projectId) {
        return `❌ Không lấy được projectId từ báo giá ${quoteId}.`;
      }

      const items = args["items"] as Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        unit?: string;
        description?: string;
        taxRate?: number | null;
        vatRate?: number;
        taxExempt?: boolean;
      }>;

      if (!items?.length) {
        return `❌ Phải có ít nhất 1 hạng mục.`;
      }

      const resolvedItems: Array<Record<string, unknown>> = [];
      for (let i = 0; i < items.length; i++) {
        const { vatRate, taxExempt, taxRate, ...rest } = items[i]!;
        const r = resolveItemTax({ taxRate, vatRate, taxExempt });
        if (!r.ok) return `❌ Hạng mục #${i + 1} (${rest.name}): ${r.error}`;
        const out: Record<string, unknown> = { ...rest };
        if (r.value !== undefined) out["taxRate"] = r.value;
        resolvedItems.push(out);
      }

      // Bao gồm các fields hiện có để tránh backend ghi đè về undefined
      // (updateQuoteSchema = createQuoteSchema không phải PartialType)
      const patchBody: Record<string, unknown> = { projectId, items: resolvedItems, status: quote.status ?? "DRAFT" };
      if (quote.validUntil != null) patchBody["validUntil"] = quote.validUntil;
      if (quote.taxRate != null) patchBody["taxRate"] = quote.taxRate;
      if (quote.terms != null) patchBody["terms"] = quote.terms;
      if (quote.deliveryTerms != null) patchBody["deliveryTerms"] = quote.deliveryTerms;
      if (quote.internalNote != null) patchBody["internalNote"] = quote.internalNote;
      await client.patch<unknown>(`/quotes/${quoteId}`, patchBody);

      // Đọc lại để hiển thị kết quả
      const updatedRes = await client.get<unknown>(`/quotes/${quoteId}`);
      const updated = extractData<QuoteDetail>(updatedRes.data);
      const updatedItems = updated.items ?? [];

      let out = `✅ Đã cập nhật báo giá **${updated.quoteNo}** — ${updatedItems.length} hạng mục:\n\n`;
      updatedItems.forEach((item, i) => {
        out += `  ${i + 1}. ${item.name}`;
        if (item.quantity != null && item.unitPrice != null) {
          out += ` — ${item.quantity} ${item.unit ?? ""} × ${formatVND(item.unitPrice)} = **${formatVND(item.total)}**`;
        }
        out += `${rateSuffix(item.taxRate)}\n`;
      });
      out += totalsBlock(updated);

      return out;
    },
  },

  {
    name: "update_quote",
    description:
      "Sửa thông tin chung của báo giá DRAFT/REJECTED: ghi chú nội bộ, hiệu lực, VAT mặc định cho dòng mới. " +
      "Các dòng hiện có giữ nguyên VAT riêng. (Báo giá không có trường tiêu đề nên không hỗ trợ title.)",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá" },
        notes: { type: "string", description: "Ghi chú nội bộ (internalNote)" },
        validUntil: { type: "string", description: "Hiệu lực đến, ngày ISO (YYYY-MM-DD)" },
        validDays: { type: "number", description: "Hiệu lực tính từ hôm nay (ngày); bỏ qua nếu có validUntil" },
        defaultVatRate: { type: "number", minimum: 0, maximum: 1, description: "VAT mặc định cho dòng MỚI, phân số 0..1 (0.08 = 8%). Không đổi VAT các dòng đang có" },
      },
      required: ["quoteId"],
    },
    async handler(args) {
      const client = getApiClient();
      const quoteId = args["quoteId"] as string;

      let newTaxRate: number | undefined;
      if (args["defaultVatRate"] !== undefined) {
        const r = vatFractionToPercent(args["defaultVatRate"], "defaultVatRate");
        if (!r.ok) return `❌ ${r.error}`;
        newTaxRate = r.value;
      }
      let newValidUntil: string | undefined;
      if (typeof args["validUntil"] === "string") {
        const d = new Date(args["validUntil"]);
        if (Number.isNaN(d.getTime())) return `❌ validUntil không hợp lệ: "${args["validUntil"]}" (dùng YYYY-MM-DD).`;
        newValidUntil = d.toISOString();
      } else if (typeof args["validDays"] === "number") {
        const d = new Date();
        d.setDate(d.getDate() + args["validDays"]);
        newValidUntil = d.toISOString();
      }

      const quote = extractData<QuoteDetail>((await client.get<unknown>(`/quotes/${quoteId}`)).data);
      if (quote.status && !["DRAFT", "REJECTED"].includes(quote.status)) {
        return `❌ Báo giá **${quote.quoteNo}** đang ở trạng thái "${quote.status}" — chỉ sửa được khi DRAFT hoặc bị từ chối.`;
      }
      const projectId = quote.project?.id;
      if (!projectId) return `❌ Không lấy được projectId từ báo giá ${quoteId}.`;
      if (!quote.items?.length) return `❌ Báo giá ${quote.quoteNo} chưa có hạng mục nào.`;

      // Gửi lại từng dòng với VAT hiện tại (tường minh) để đổi mức mặc định không làm đổi dòng cũ.
      const items = quote.items.map((it) => {
        const o: Record<string, unknown> = {
          name: it.name,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        };
        if (it.unit) o["unit"] = it.unit;
        if (it.description) o["description"] = it.description;
        if (it.bomId) o["bomId"] = it.bomId;
        return o;
      });

      const body: Record<string, unknown> = { projectId, items, status: quote.status ?? "DRAFT" };
      const validUntil = newValidUntil ?? quote.validUntil;
      if (validUntil != null) body["validUntil"] = validUntil;
      const taxRate = newTaxRate ?? (quote.taxRate != null ? Number(quote.taxRate) : undefined);
      if (taxRate !== undefined) body["taxRate"] = taxRate;
      if (quote.terms != null) body["terms"] = quote.terms;
      if (quote.deliveryTerms != null) body["deliveryTerms"] = quote.deliveryTerms;
      const note = (args["notes"] as string | undefined) ?? quote.internalNote;
      if (note != null) body["internalNote"] = note;
      await client.patch<unknown>(`/quotes/${quoteId}`, body);

      const u = extractData<QuoteDetail>((await client.get<unknown>(`/quotes/${quoteId}`)).data);
      return (
        `✅ Đã cập nhật báo giá **${u.quoteNo}** (${QUOTE_STATUS_LABEL[u.status ?? ""] ?? u.status})\n` +
        `⏳ Hiệu lực đến: ${formatDate(u.validUntil)}\n` +
        `🧾 VAT mặc định dòng mới: ${u.taxRate != null ? rateText(u.taxRate) : "—"}` +
        (u.internalNote ? `\n📝 Ghi chú nội bộ: ${truncate(u.internalNote)}` : "") +
        totalsBlock(u)
      );
    },
  },

  {
    name: "update_quote_status",
    description:
      "Cập nhật trạng thái báo giá (đã gửi, khách chấp nhận, từ chối). " +
      "Dùng khi: 'Đánh dấu BG-2026-012 đã gửi cho KH', 'KH Sabeco từ chối báo giá BG-2026-008'.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá" },
        status: {
          type: "string",
          enum: ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
          description: "Trạng thái mới",
        },
        notes: { type: "string", description: "Lý do từ chối, ghi chú khi gửi..." },
      },
      required: ["quoteId", "status"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = { status: args["status"] };
      if (args["notes"]) payload["notes"] = args["notes"];

      const res = await client.patch<unknown>(`/quotes/${args["quoteId"] as string}/status`, payload);
      const q = extractData<{ quoteNo: string; status: string }>(res.data);
      const statusMap: Record<string, string> = {
        SENT: "📤 Đã gửi",
        ACCEPTED: "✅ KH chấp nhận",
        REJECTED: "❌ KH từ chối",
        EXPIRED: "⏰ Hết hạn",
      };

      const status = statusMap[q.status] ?? q.status;
      return `✅ Báo giá ${q.quoteNo} → ${status}`;
    },
  },

  {
    name: "delete_quote",
    description:
      "Xoá báo giá khỏi hệ thống. Chỉ xoá được báo giá ở trạng thái DRAFT hoặc REJECTED. " +
      "Dùng khi: 'Xoá báo giá nháp nhầm', 'Dọn dẹp báo giá bị từ chối cũ'.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá cần xoá" },
      },
      required: ["quoteId"],
    },
    async handler(args) {
      const client = getApiClient();
      const res = await client.delete<unknown>(`/quotes/${args["quoteId"] as string}`);
      const q = extractData<{ quoteNo: string }>(res.data);
      return `✅ Đã xoá báo giá "${q.quoteNo ?? args["quoteId"]}"`;
    },
  },

  {
    name: "duplicate_quote",
    description:
      "Nhân bản một báo giá hiện có. " +
      "Dùng khi: 'Nhân bản BG-2026-008 để làm phiên bản v2', 'Copy báo giá cũ cho dự án mới'.",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: { type: "string", description: "ID báo giá cần nhân bản" },
        projectId: { type: "string", description: "ID dự án (nếu muốn nhân bản sang dự án khác)" },
      },
      required: ["quoteId"],
    },
    async handler(args) {
      const client = getApiClient();
      const payload: Record<string, unknown> = {};
      if (args["projectId"]) payload["projectId"] = args["projectId"];

      const res = await client.post<unknown>(`/quotes/${args["quoteId"] as string}/duplicate`, payload);
      const q = extractData<{ id: string; quoteNo: string }>(res.data);

      return `✅ Đã nhân bản → ${q.quoteNo} [Bản nháp] | ID: ${q.id}`;
    },
  },
];

// Interfaces

interface QuoteListItem {
  id: string;
  quoteNo: string;
  status?: string;
  subtotal?: number | string;
  taxAmount?: number | string;
  taxBreakdown?: TaxGroup[];
  total?: number | string;
  createdAt?: string;
  project?: { name?: string; customer?: { name: string } };
}

interface QuoteDetail {
  id: string;
  quoteNo: string;
  status?: string;
  subtotal?: number | string;
  taxAmount?: number | string;
  total?: number | string;
  taxRate?: number | string;
  taxBreakdown?: TaxGroup[];
  validUntil?: string;
  terms?: string;
  deliveryTerms?: string;
  internalNote?: string;
  createdAt?: string;
  sentAt?: string;
  notes?: string;
  project?: { id: string; name: string; customer?: { name: string } };
  items?: Array<{
    name: string;
    quantity?: number | string;
    unit?: string;
    description?: string;
    bomId?: string | null;
    unitPrice: number | string;
    total: number | string;
    taxRate?: number | string | null;
  }>;
}
