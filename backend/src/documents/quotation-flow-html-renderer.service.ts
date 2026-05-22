import { Injectable } from "@nestjs/common";
import type { DocumentLanguage } from "./dto/document-type.enum";

type Primitive = string | number | boolean | Date | null | undefined;
type RecordValue = Primitive | Record<string, unknown> | Array<unknown>;

const DEFAULT_COLUMN_WIDTHS = {
  index: 6,
  name: 41,
  description: 23,
  quantity: 6,
  unitPrice: 12,
  total: 12
} as const;

const COLUMN_KEYS = ["index", "name", "description", "quantity", "unitPrice", "total"] as const;
type QuoteColumnKey = (typeof COLUMN_KEYS)[number];

interface QuoteLineItem {
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuotationLabels {
  title: string;
  quoteNo: string;
  version: string;
  validUntil: string;
  customer: string;
  company: string;
  taxCode: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  contact: string;
  introPrefix: string;
  introSuffix: string;
  index: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  subtotal: string;
  vat: string;
  grandTotal: string;
  paymentTerms: string;
  deliveryTerms: string;
  signatureSeller: string;
  signatureBuyer: string;
}

@Injectable()
export class QuotationFlowHtmlRendererService {
  renderBody(context: Record<string, unknown>, language: DocumentLanguage): string {
    const labels = this.getLabels(language);
    const quote = this.getRecord(context, "quote");
    const project = this.getRecord(context, "project");
    const customer = this.getRecord(context, "customer");
    const company = this.getRecord(context, "company");
    const primaryContact = this.getRecord(context, "primaryContact");
    const items = this.getLineItems(context);
    const columnWidths = this.normalizeColumnWidths(
      this.getValue(context, "quote.tableColumnWidths") ?? this.getValue(context, "tableColumnWidths")
    );

    const quoteNo = this.toText(quote.quoteNo) || this.toText(context.docNumber) || "-";
    const version = this.toText(quote.version) || "1";
    const validUntil = this.formatDate(quote.validUntil);
    const projectName = this.toText(project.name) || this.toText(quote.projectName) || "";
    const customerName = this.toText(customer.name) || labels.customer;
    const subtotal = this.toNumber(quote.subtotal);
    const taxRate = this.toNumber(quote.taxRate);
    const taxAmount = this.toNumber(quote.taxAmount);
    const grandTotal = this.toNumber(quote.total);

    return `
<article class="quotation-flow">
  <header class="quotation-header">
    <div class="brand-row">
      ${this.renderLogo(context.logo)}
      <div class="title-block">
        <h1>${labels.title}</h1>
        <p>${labels.quoteNo}: <strong>${this.escape(quoteNo)}</strong> | ${labels.version}: <strong>${this.escape(version)}</strong>${validUntil ? ` | ${labels.validUntil}: <strong>${validUntil}</strong>` : ""}</p>
      </div>
    </div>
  </header>

  <section class="party-grid">
    ${this.renderInfoCard(labels.customer, [
      [labels.customer, customerName],
      [labels.address, this.toText(customer.address)],
      [labels.phone, this.toText(customer.phone)],
      [labels.email, this.toText(customer.email)],
      [labels.contact, this.toText(primaryContact.name)]
    ])}
    ${this.renderInfoCard(labels.company, [
      [labels.company, this.toText(company.name)],
      [labels.taxCode, this.toText(company.taxCode) || this.toText(company.taxId)],
      [labels.address, this.toText(company.address)],
      [labels.phone, this.toText(company.phone)],
      [labels.email, this.toText(company.email)],
      [labels.website, this.toText(company.website)]
    ])}
  </section>

  <section class="quotation-intro">
    <p>${labels.introPrefix} <strong>${this.escape(customerName)}</strong>${projectName ? ` ${this.escape(projectName)}` : ""}. ${labels.introSuffix}</p>
  </section>

  <table class="line-items">
    <colgroup>
      ${COLUMN_KEYS.map((key) => `<col style="width: ${columnWidths[key].toFixed(4)}%" />`).join("\n      ")}
    </colgroup>
    <thead>
      <tr>
        <th class="text-center">${labels.index}</th>
        <th>${labels.name}</th>
        <th>${labels.description}</th>
        <th class="text-center">${labels.quantity}</th>
        <th class="text-right">${labels.unitPrice}</th>
        <th class="text-right">${labels.total}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, index) => this.renderLineItem(item, index)).join("\n")}
    </tbody>
  </table>

  <section class="commercial-tail">
    <div class="terms-box">
      <p class="section-label">${labels.paymentTerms}</p>
      <div>${this.renderMultiline(this.toText(quote.terms) || "Theo thỏa thuận trong hợp đồng kinh tế.")}</div>
      ${quote.deliveryTerms ? `
      <p class="section-label section-label--spaced">${labels.deliveryTerms}</p>
      <div>${this.renderMultiline(this.toText(quote.deliveryTerms))}</div>` : ""}
    </div>
    <div class="summary-box">
      <table class="summary-table">
        <tbody>
          <tr>
            <th>${labels.subtotal}</th>
            <td>${this.formatCurrency(subtotal)}</td>
          </tr>
          <tr>
            <th>${labels.vat}${Number.isFinite(taxRate) ? ` (${this.formatPercent(taxRate)})` : ""}</th>
            <td>${this.formatCurrency(taxAmount)}</td>
          </tr>
          <tr class="summary-total">
            <th>${labels.grandTotal}</th>
            <td>${this.formatCurrency(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="signature-block">
    <div>
      <p>${labels.signatureSeller}</p>
      <span>${this.escape(this.toText(company.representativeTitle) || "")}</span>
      <strong>${this.escape(this.toText(company.representative) || "")}</strong>
    </div>
    <div>
      <p>${labels.signatureBuyer}</p>
      <span>&nbsp;</span>
      <strong>&nbsp;</strong>
    </div>
  </section>
</article>`;
  }

  getCss(): string {
    return `
/* Load font via file:// so WeasyPrint reads the TTF directly (not via fontconfig/Pango).
   This is required for correct ToUnicode CMap generation in the PDF text layer.
   The local() fallback is used in dev environments where the Docker paths do not exist. */
@font-face {
  font-family: "Noto Sans";
  font-weight: 400;
  font-style: normal;
  src: url("file:///usr/share/fonts/noto/NotoSans-Regular.ttf") format("truetype"),
       local("Noto Sans"), local("NotoSans-Regular");
}
@font-face {
  font-family: "Noto Sans";
  font-weight: 700;
  font-style: normal;
  src: url("file:///usr/share/fonts/noto/NotoSans-Bold.ttf") format("truetype"),
       local("Noto Sans Bold"), local("NotoSans-Bold");
}

@page {
  size: A4;
  margin: 14mm 12mm 16mm;
  @bottom-right {
    content: "Trang " counter(page) " / " counter(pages);
    color: #5d6d7e;
    font-size: 8.5px;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: #111827;
  font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif;
  font-size: 10.5px;
  line-height: 1.45;
}

.quotation-flow {
  width: 100%;
}

.quotation-header {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  break-inside: avoid;
}

.brand-row {
  display: table;
  width: 100%;
}

.brand-logo,
.title-block {
  display: table-cell;
  vertical-align: middle;
}

.brand-logo {
  width: 90px;
}

.brand-logo img {
  max-width: 78px;
  max-height: 48px;
  object-fit: contain;
}

.title-block h1 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 20px;
  letter-spacing: 0.08em;
  text-align: center;
}

.title-block p {
  margin: 0;
  text-align: center;
}

.party-grid {
  display: table;
  width: 100%;
  table-layout: fixed;
  border-spacing: 14px 0;
  margin: 0 -14px 14px;
}

.info-card {
  display: table-cell;
  width: 50%;
  vertical-align: top;
  break-inside: avoid;
}

.info-card table {
  width: 100%;
  border-collapse: collapse;
}

.info-card th,
.info-card td {
  border-bottom: 1px solid #d7dee8;
  padding: 3px 0;
  vertical-align: top;
}

.info-card th {
  width: 32%;
  color: #111827;
  font-weight: 700;
  text-align: left;
}

.quotation-intro {
  margin: 14px 0 16px;
}

.quotation-intro p {
  margin: 0;
}

table.line-items {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  page-break-inside: auto;
}

.line-items thead {
  display: table-header-group;
}

.line-items tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

.line-items th,
.line-items td {
  border: 1px solid #cbd5e1;
  padding: 6px 7px;
  vertical-align: top;
  overflow-wrap: anywhere;
}

.line-items th {
  background: #e2e8f0;
  color: #0f172a;
  font-weight: 700;
}

.line-items td p {
  margin: 0 0 3px;
}

.line-items td p:last-child {
  margin-bottom: 0;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.commercial-tail {
  display: table;
  width: 100%;
  table-layout: fixed;
  border-spacing: 14px 0;
  margin: 18px -14px 0;
}

.terms-box,
.summary-box {
  display: table-cell;
  vertical-align: top;
}

.terms-box {
  width: 62%;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px;
}

.section-label {
  margin: 0 0 5px;
  font-weight: 700;
}

.section-label--spaced {
  margin-top: 12px;
}

.terms-box p:last-child {
  margin-bottom: 0;
}

.summary-box {
  width: 38%;
  padding-left: 8px;
  break-inside: avoid;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
}

.summary-table th,
.summary-table td {
  border-bottom: 1px solid #d7dee8;
  padding: 5px 0;
}

.summary-table th {
  text-align: left;
  font-weight: 700;
}

.summary-table td {
  text-align: right;
}

.summary-total th,
.summary-total td {
  color: #0f172a;
  font-weight: 800;
}

.signature-block {
  display: table;
  width: 100%;
  table-layout: fixed;
  margin-top: 18mm;
  break-inside: avoid;
  page-break-inside: avoid;
}

.signature-block > div {
  display: table-cell;
  width: 50%;
  text-align: center;
  vertical-align: top;
}

.signature-block p {
  margin: 0 0 6px;
  font-weight: 800;
}

.signature-block span {
  display: block;
  min-height: 42px;
}

.signature-block strong {
  display: block;
}
`;
  }

  private renderLineItem(item: QuoteLineItem, index: number): string {
    return `<tr>
        <td class="text-center">${index + 1}</td>
        <td>${this.escape(item.name)}</td>
        <td>${this.renderMultiline(item.description)}</td>
        <td class="text-center">${this.escape(this.formatQuantity(item.quantity, item.unit))}</td>
        <td class="text-right">${this.formatCurrency(item.unitPrice)}</td>
        <td class="text-right">${this.formatCurrency(item.total)}</td>
      </tr>`;
  }

  private renderInfoCard(title: string, rows: Array<[string, string]>): string {
    return `<div class="info-card">
      <table>
        <tbody>
          ${rows
            .filter(([, value]) => value.trim().length > 0)
            .map(([label, value]) => `<tr><th>${this.escape(label)}</th><td>${this.escape(value)}</td></tr>`)
            .join("\n")}
        </tbody>
      </table>
    </div>`;
  }

  private renderLogo(rawLogo: unknown): string {
    const logo = this.toText(rawLogo);
    if (!logo) {
      return `<div class="brand-logo"></div>`;
    }

    return `<div class="brand-logo"><img src="${this.escapeAttribute(logo)}" alt="AHSO" /></div>`;
  }

  private getLineItems(context: Record<string, unknown>): QuoteLineItem[] {
    const rawItems = this.getArray(context, "items");
    return rawItems.map((raw) => {
      const item = this.asRecord(raw);
      return {
        name: this.toText(item.name),
        description: this.toText(item.description),
        unit: this.toText(item.unit),
        quantity: this.toNumber(item.quantity),
        unitPrice: this.toNumber(item.unitPrice),
        total: this.toNumber(item.total)
      };
    });
  }

  private normalizeColumnWidths(rawWidths: unknown): Record<QuoteColumnKey, number> {
    const rawRecord = this.asRecord(rawWidths);
    const values = COLUMN_KEYS.reduce<Partial<Record<QuoteColumnKey, number>>>((result, key) => {
      const value = this.toNumber(rawRecord[key]);
      if (Number.isFinite(value) && value > 0) {
        result[key] = value;
      }
      return result;
    }, {});

    const complete = COLUMN_KEYS.every((key) => typeof values[key] === "number");
    const base = complete ? (values as Record<QuoteColumnKey, number>) : DEFAULT_COLUMN_WIDTHS;
    const total = COLUMN_KEYS.reduce((sum, key) => sum + base[key], 0) || 1;

    return COLUMN_KEYS.reduce<Record<QuoteColumnKey, number>>((result, key) => {
      result[key] = (base[key] / total) * 100;
      return result;
    }, {} as Record<QuoteColumnKey, number>);
  }

  private getLabels(language: DocumentLanguage): QuotationLabels {
    if (language === "vi-en") {
      return {
        title: "QUOTATION",
        quoteNo: "Quotation No.",
        version: "Version",
        validUntil: "Valid until",
        customer: "Customer",
        company: "Company",
        taxCode: "Tax code",
        address: "Address",
        phone: "Phone",
        email: "Email",
        website: "Website",
        contact: "Contact",
        introPrefix: "AHSO respectfully submits this quotation to",
        introSuffix: "We believe this solution fits your operational and growth objectives.",
        index: "No.",
        name: "Item",
        description: "Description",
        quantity: "Qty",
        unitPrice: "Unit price",
        total: "Amount",
        subtotal: "Subtotal",
        vat: "VAT",
        grandTotal: "Grand total",
        paymentTerms: "Payment terms",
        deliveryTerms: "Delivery / deployment terms",
        signatureSeller: "AHSO REPRESENTATIVE",
        signatureBuyer: "CUSTOMER REPRESENTATIVE"
      };
    }

    return {
      title: "BÁO GIÁ",
      quoteNo: "Số báo giá",
      version: "Phiên bản",
      validUntil: "Hiệu lực",
      customer: "Khách hàng",
      company: "Công ty",
      taxCode: "MST",
      address: "Địa chỉ",
      phone: "Điện thoại",
      email: "Email",
      website: "Website",
      contact: "Người liên hệ",
      introPrefix: "AHSO trân trọng gửi tới",
      introSuffix: "Chúng tôi tin rằng giải pháp này phù hợp với mục tiêu vận hành và tăng trưởng của doanh nghiệp.",
      index: "STT",
      name: "Hạng mục",
      description: "Mô tả",
      quantity: "SL",
      unitPrice: "Đơn giá",
      total: "Thành tiền",
      subtotal: "Tạm tính",
      vat: "Thuế",
      grandTotal: "Tổng cộng",
      paymentTerms: "Điều khoản thanh toán",
      deliveryTerms: "Điều khoản giao hàng / triển khai",
      signatureSeller: "ĐẠI DIỆN AHSO",
      signatureBuyer: "ĐẠI DIỆN KHÁCH HÀNG"
    };
  }

  private getRecord(context: Record<string, unknown>, path: string): Record<string, RecordValue> {
    return this.asRecord(this.getValue(context, path));
  }

  private getArray(context: Record<string, unknown>, path: string): unknown[] {
    const value = this.getValue(context, path);
    return Array.isArray(value) ? value : [];
  }

  private getValue(context: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, context);
  }

  private asRecord(value: unknown): Record<string, RecordValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, RecordValue>;
  }

  private toText(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return "";
  }

  private toNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }
    return 0;
  }

  private formatDate(value: unknown): string {
    const text = this.toText(value);
    if (!text) {
      return "";
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return this.escape(text);
    }

    return this.escape(new Intl.DateTimeFormat("vi-VN").format(date));
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
  }

  private formatPercent(value: number): string {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 2
    }).format(Number.isFinite(value) ? value : 0) + "%";
  }

  private formatQuantity(quantity: number, unit: string): string {
    const formatted = new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 2
    }).format(Number.isFinite(quantity) ? quantity : 0);

    return unit ? `${formatted} ${unit}` : formatted;
  }

  private renderMultiline(value: string): string {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return "";
    }

    return lines.map((line) => `<p>${this.escape(line)}</p>`).join("");
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private escapeAttribute(value: string): string {
    return this.escape(value).replace(/`/g, "&#96;");
  }
}
