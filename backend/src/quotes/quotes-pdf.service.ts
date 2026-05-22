import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtUser } from "../auth/auth.types";
import { renderPdfBuffer } from "../common/pdf/pdf.utils";
import { SettingsService } from "../settings/settings.service";
import { UploadService } from "../upload/upload.service";
import { QuotesService } from "./quotes.service";

type QuotePdfData = Awaited<ReturnType<QuotesService["findOne"]>>;
type QuoteTableColumnWidths = NonNullable<QuotePdfData["tableColumnWidths"]>;

const DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS: QuoteTableColumnWidths = {
  index: 6,
  name: 41,
  description: 23,
  quantity: 6,
  unitPrice: 12,
  total: 12
};

@Injectable()
export class QuotesPdfService {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly settingsService: SettingsService,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService
  ) {}

  async generatePdf(quoteId: string, user: JwtUser) {
    const [quote, settings] = await Promise.all([
      this.quotesService.findOne(quoteId, user),
      this.settingsService.getAllSettings()
    ]);
    const logoSrc = await this.resolveLogoSource(settings.logo);
    const pdf = await renderPdfBuffer(
      this.buildHtml(
        quote,
        settings.company ?? {},
        settings.policies ?? {},
        logoSrc
      ),
      this.configService
    );

    return {
      filename: `${quote.quoteNo}-v${quote.version}.pdf`,
      buffer: Buffer.from(pdf)
    };
  }

  private async resolveLogoSource(logoUrl?: string | null) {
    if (!logoUrl) {
      return null;
    }

    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://") || logoUrl.startsWith("data:")) {
      return logoUrl;
    }

    return this.uploadService.readFileAsDataUrl(logoUrl);
  }

  private buildHtml(
    quote: QuotePdfData,
    company: Record<string, unknown>,
    policies: Record<string, unknown>,
    logoSrc: string | null
  ) {
    const companyName = stringOrFallback(company.name, "AHSO CRM");
    const companyTaxId = stringOrFallback(company.taxId);
    const companyAddress = stringOrFallback(company.address);
    const companyPhone = stringOrFallback(company.phone);
    const companyEmail = stringOrFallback(company.email);
    const companyWebsite = stringOrFallback(company.website);
    const paymentTerms = stringOrFallback(quote.terms) || stringOrFallback(policies.paymentTerms) || "Điều khoản thanh toán sẽ được xác nhận khi chốt PO/HĐ.";
    const deliveryTerms =
      stringOrFallback(quote.deliveryTerms) ||
      stringOrFallback(policies.service) ||
      "Tiến độ triển khai sẽ được xác nhận theo survey và kế hoạch điều động kỹ thuật.";
    const tableWidths = normalizeQuoteTableWidths(quote.tableColumnWidths);

    const contactLine = [
      quote.project.customer.primaryContact?.name ? escapeHtml(quote.project.customer.primaryContact.name) : "Chưa thiết lập",
      quote.project.customer.primaryContact?.title ? escapeHtml(quote.project.customer.primaryContact.title) : null
    ]
      .filter(Boolean)
      .join(" - ");

    const companyMetaLines = [
      companyAddress,
      [companyPhone ? `Hotline: ${companyPhone}` : null, companyEmail ? `Email: ${companyEmail}` : null].filter(Boolean).join(" | "),
      [companyWebsite ? `Website: ${companyWebsite}` : null, companyTaxId ? `MST: ${companyTaxId}` : null].filter(Boolean).join(" | ")
    ].filter(Boolean);

    const rows = quote.items
      .map(
        (item, index) => `
          <tr>
            <td class="center">${String(index + 1).padStart(2, "0")}</td>
            <td>
              <div class="item-name">${escapeHtml(item.name)}</div>
            </td>
            <td>${item.description ? `<div class="muted">${escapeHtml(item.description)}</div>` : ""}</td>
            <td class="center">${formatQuantity(item.quantity)}</td>
            <td class="right">${formatCurrency(item.unitPrice)}</td>
            <td class="right strong">${formatCurrency(item.total)}</td>
          </tr>
        `
      )
      .join("");

    return `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(quote.quoteNo)}</title>
          <style>
            ${basePdfStyles()}
            .document-title { text-align: center; margin: 18px 0 8px; }
            .document-title h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 0.18em; color: #1A5276; }
            .document-title p { margin: 6px 0 0; font-size: 11px; color: #5D6D7E; }
            .summary-box { width: 320px; margin-left: auto; border: 1px solid #D5D8DC; border-radius: 16px; background: #F8FAFC; padding: 14px 16px; }
            .summary-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 8px; font-size: 13px; }
            .summary-row strong { font-size: 15px; color: #1A5276; }
          </style>
        </head>
        <body>
          <div class="page">
            <header class="doc-header">
              <div class="brand">
                ${
                  logoSrc
                    ? `<div class="logo-box"><img src="${logoSrc}" alt="${escapeHtml(companyName)}" class="logo-image" /></div>`
                    : `<div class="logo-fallback">A</div>`
                }
                <div>
                  <div class="brand-name">${escapeHtml(companyName)}</div>
                  <div class="brand-tag">Automation Hub</div>
                </div>
              </div>
              <div class="company-meta">
                ${companyMetaLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
              </div>
            </header>

            <div class="divider"></div>

            <section class="document-title">
              <h1>Báo Giá</h1>
              <p>Số: ${escapeHtml(quote.quoteNo)} · v${quote.version}</p>
              <p>Ngày lập: ${formatDate(quote.createdAt)}</p>
            </section>

            <section class="info-card">
              <div>
                <div class="section-label">Kính gửi khách hàng</div>
                <div class="strong text-primary">${escapeHtml(quote.project.customer.name)}</div>
                <div class="muted">${contactLine}</div>
                ${quote.project.customer.taxCode ? `<div class="muted">MST: ${escapeHtml(quote.project.customer.taxCode)}</div>` : ""}
              </div>
              <div class="align-right">
                <div class="section-label">Địa chỉ giao hàng</div>
                <div class="muted">${escapeHtml(quote.project.customer.address ?? "Địa chỉ sẽ được xác nhận khi chốt PO/HĐ.")}</div>
                ${
                  quote.project.customer.primaryContact?.phone
                    ? `<div class="muted">Điện thoại: ${escapeHtml(quote.project.customer.primaryContact.phone)}</div>`
                    : ""
                }
                ${quote.validUntil ? `<div class="muted">Hiệu lực đến: ${formatDate(quote.validUntil)}</div>` : ""}
              </div>
            </section>

            <p class="lead">
              AHSO xin chân thành cảm ơn Quý khách hàng đã quan tâm đến giải pháp của chúng tôi. Căn cứ theo nhu cầu của dự án
              <strong>${escapeHtml(quote.project.name)}</strong>, chúng tôi gửi báo giá chi tiết như sau:
            </p>

            <table>
              <colgroup>
                <col style="width:${tableWidths.index.toFixed(4)}%" />
                <col style="width:${tableWidths.name.toFixed(4)}%" />
                <col style="width:${tableWidths.description.toFixed(4)}%" />
                <col style="width:${tableWidths.quantity.toFixed(4)}%" />
                <col style="width:${tableWidths.unitPrice.toFixed(4)}%" />
                <col style="width:${tableWidths.total.toFixed(4)}%" />
              </colgroup>
              <thead>
                <tr>
                  <th class="center">STT</th>
                  <th>Hạng mục</th>
                  <th>Mô tả</th>
                  <th class="center">SL</th>
                  <th class="right">Đơn giá</th>
                  <th class="right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <section style="margin-top: 18px;">
              <div class="summary-box">
                <div class="summary-row"><span>Tạm tính</span><span>${formatCurrency(quote.subtotal)}</span></div>
                <div class="summary-row"><span>VAT (${quote.taxRate}%)</span><span>${formatCurrency(quote.taxAmount)}</span></div>
                <div class="summary-row"><span><strong>Tổng cộng</strong></span><span><strong>${formatCurrency(quote.total)}</strong></span></div>
              </div>
            </section>

            <section class="grid-2">
              <div class="note-card">
                <div class="section-label">Điều khoản thanh toán</div>
                <div class="note-text">${multilineHtml(paymentTerms)}</div>
              </div>
              <div class="note-card">
                <div class="section-label">Giao hàng / triển khai</div>
                <div class="note-text">${multilineHtml(deliveryTerms)}</div>
              </div>
            </section>

            <section class="footer-band">
              <div>
                <div class="chip">Project: ${escapeHtml(quote.project.code)}</div>
                <p class="muted" style="margin-top: 14px;">
                  Báo giá do ${escapeHtml(quote.createdBy.name)} lập.${quote.createdBy.email ? ` Email liên hệ: ${escapeHtml(quote.createdBy.email)}.` : ""}
                </p>
              </div>
              <div class="signature">
                <div class="section-label">Đại diện AHSO</div>
                <div class="signature-line">${escapeHtml(quote.createdBy.name)}</div>
              </div>
            </section>
          </div>
        </body>
      </html>
    `;
  }
}

function basePdfStyles() {
  return `
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1C2833; font-family: Arial, "Helvetica Neue", sans-serif; font-size: 12px; }
    .page { width: 100%; }
    .doc-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
    .brand { display: flex; align-items: center; gap: 12px; max-width: 46%; }
    .logo-box, .logo-fallback { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: #1A5276; color: #fff; font-size: 24px; font-weight: 700; overflow: hidden; }
    .logo-box { background: #ffffff; border: 1px solid #D5D8DC; }
    .logo-image { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #1A5276; line-height: 1.2; }
    .brand-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.22em; color: rgba(26,82,118,0.7); text-transform: uppercase; }
    .company-meta { max-width: 48%; text-align: right; font-size: 11px; line-height: 1.55; color: #5D6D7E; }
    .divider { margin-top: 16px; height: 2px; background: #1A5276; }
    .info-card { margin-top: 20px; border-left: 4px solid #1A5276; border-radius: 16px; background: #F8FAFC; padding: 16px 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: #5D6D7E; }
    .text-primary { color: #1A5276; }
    .strong { font-weight: 700; }
    .align-right { text-align: right; }
    .lead { margin: 18px 0 0; font-size: 12px; line-height: 1.7; color: #5D6D7E; }
    .muted { color: #5D6D7E; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; border: 1px solid #D5D8DC; border-radius: 16px; overflow: hidden; }
    table { table-layout: fixed; }
    thead tr { background: #1A5276; color: #ffffff; }
    th { padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; }
    td { padding: 10px 12px; border-top: 1px solid #E5E7EB; vertical-align: top; }
    tbody tr:nth-child(even) { background: #F8FAFC; }
    .item-name { font-weight: 700; color: #1C2833; }
    .center { text-align: center; }
    .right { text-align: right; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
    .note-card { border: 1px solid #D5D8DC; border-radius: 16px; background: #F8FAFC; padding: 14px 16px; min-height: 130px; }
    .note-text { margin-top: 10px; color: #5D6D7E; line-height: 1.7; white-space: normal; }
    .footer-band { margin-top: 24px; padding-top: 22px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
    .chip { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #EBF5FB; color: #1A5276; font-weight: 700; font-size: 11px; }
    .signature { min-width: 220px; text-align: center; }
    .signature-line { margin-top: 72px; padding-top: 8px; border-top: 1px solid #D5D8DC; font-size: 12px; color: #5D6D7E; }
`;
}

function normalizeQuoteTableWidths(widths?: QuoteTableColumnWidths | null) {
  const next = widths ?? DEFAULT_QUOTE_TABLE_COLUMN_WIDTHS;
  const total = Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0) || 1;

  return {
    index: (next.index / total) * 100,
    name: (next.name / total) * 100,
    description: (next.description / total) * 100,
    quantity: (next.quantity / total) * 100,
    unitPrice: (next.unitPrice / total) * 100,
    total: (next.total / total) * 100
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function multilineHtml(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function stringOrFallback(value: unknown, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}
