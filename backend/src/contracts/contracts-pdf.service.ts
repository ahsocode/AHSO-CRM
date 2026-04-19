import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtUser } from "../auth/auth.types";
import { renderPdfBuffer } from "../common/pdf/pdf.utils";
import { SettingsService } from "../settings/settings.service";
import { UploadService } from "../upload/upload.service";
import { ContractsService } from "./contracts.service";

type ContractPdfData = Awaited<ReturnType<ContractsService["findOne"]>>;

@Injectable()
export class ContractsPdfService {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly settingsService: SettingsService,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService
  ) {}

  async generateAcceptancePdf(contractId: string, user: JwtUser) {
    const [contract, settings] = await Promise.all([
      this.contractsService.findOne(contractId, user),
      this.settingsService.getAllSettings()
    ]);
    const logoSrc = await this.resolveLogoSource(settings.logo);
    const pdf = await renderPdfBuffer(
      this.buildHtml(
        contract,
        settings.company ?? {},
        logoSrc
      ),
      this.configService
    );

    return {
      filename: `BBNT-${contract.contractNo}.pdf`,
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

  private buildHtml(contract: ContractPdfData, company: Record<string, unknown>, logoSrc: string | null) {
    const companyName = stringOrFallback(company.name, "AHSO CRM");
    const companyTaxId = stringOrFallback(company.taxId);
    const companyAddress = stringOrFallback(company.address);
    const companyPhone = stringOrFallback(company.phone);
    const companyEmail = stringOrFallback(company.email);
    const companyWebsite = stringOrFallback(company.website);
    const acceptanceDate = this.resolveAcceptanceDate(contract);
    const companyMetaLines = [
      companyAddress,
      [companyPhone ? `Hotline: ${companyPhone}` : null, companyEmail ? `Email: ${companyEmail}` : null].filter(Boolean).join(" | "),
      [companyWebsite ? `Website: ${companyWebsite}` : null, companyTaxId ? `MST: ${companyTaxId}` : null].filter(Boolean).join(" | ")
    ].filter(Boolean);

    const milestoneRows = contract.milestones
      .map(
        (milestone, index) => `
          <tr>
            <td class="center">${String(index + 1).padStart(2, "0")}</td>
            <td>
              <div class="item-name">${escapeHtml(milestone.name)}</div>
              ${milestone.description ? `<div class="muted">${escapeHtml(milestone.description)}</div>` : ""}
            </td>
            <td class="center">${escapeHtml(MILESTONE_LABELS[milestone.status])}</td>
            <td class="center">${milestone.dueDate ? formatDate(milestone.dueDate) : "Chưa có hạn"}</td>
            <td class="center">${milestone.completedAt ? formatDate(milestone.completedAt) : "—"}</td>
            <td class="right">${formatCurrency(milestone.paymentAmount)}</td>
          </tr>
        `
      )
      .join("");

    const paymentRows = contract.payments
      .slice(0, 6)
      .map(
        (payment) => `
          <tr>
            <td>${formatDate(payment.paidAt)}</td>
            <td>${escapeHtml(payment.method ?? "Chưa ghi nhận")}</td>
            <td>${escapeHtml(payment.reference ?? "—")}</td>
            <td class="right">${formatCurrency(payment.amount)}</td>
          </tr>
        `
      )
      .join("");

    return `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(contract.contractNo)}</title>
          <style>
            ${basePdfStyles()}
            .document-title { text-align: center; margin: 18px 0 10px; }
            .document-title h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 0.16em; color: #1A5276; }
            .document-title p { margin: 6px 0 0; font-size: 11px; color: #5D6D7E; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }
            .summary-card { border: 1px solid #D5D8DC; border-radius: 14px; background: #F8FAFC; padding: 12px 14px; }
            .summary-card .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #5D6D7E; }
            .summary-card .value { margin-top: 8px; font-size: 18px; font-weight: 800; color: #1C2833; }
            .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; }
            .signature-box { border: 1px dashed #BFC9CA; border-radius: 16px; min-height: 128px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; }
            .signature-line { margin-top: 52px; border-top: 1px solid #D5D8DC; padding-top: 8px; text-align: center; color: #5D6D7E; font-size: 12px; }
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
                  <div class="brand-tag">Acceptance Record</div>
                </div>
              </div>
              <div class="company-meta">
                ${companyMetaLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
              </div>
            </header>

            <div class="divider"></div>

            <section class="document-title">
              <h1>Biên Bản Nghiệm Thu</h1>
              <p>Hợp đồng: ${escapeHtml(contract.contractNo)} · Dự án: ${escapeHtml(contract.project.code)}</p>
              <p>Ngày nghiệm thu: ${formatDate(acceptanceDate)}</p>
            </section>

            <section class="info-card">
              <div>
                <div class="section-label">Thông tin khách hàng</div>
                <div class="strong text-primary">${escapeHtml(contract.project.customer.name)}</div>
                ${contract.project.customer.taxCode ? `<div class="muted">MST: ${escapeHtml(contract.project.customer.taxCode)}</div>` : ""}
                <div class="muted">${escapeHtml(contract.project.customer.address ?? "Chưa cập nhật địa chỉ")}</div>
              </div>
              <div class="align-right">
                <div class="section-label">Liên hệ chính</div>
                <div class="strong">${escapeHtml(contract.project.customer.primaryContact?.name ?? "Chưa thiết lập")}</div>
                <div class="muted">${escapeHtml(contract.project.customer.primaryContact?.title ?? "Chưa có chức danh")}</div>
                ${
                  contract.project.customer.primaryContact?.phone
                    ? `<div class="muted">Điện thoại: ${escapeHtml(contract.project.customer.primaryContact.phone)}</div>`
                    : ""
                }
                ${
                  contract.project.customer.primaryContact?.email
                    ? `<div class="muted">Email: ${escapeHtml(contract.project.customer.primaryContact.email)}</div>`
                    : ""
                }
              </div>
            </section>

            <p class="lead">
              Hai bên tiến hành nghiệm thu khối lượng công việc thuộc hợp đồng <strong>${escapeHtml(contract.contractNo)}</strong>
              cho dự án <strong>${escapeHtml(contract.project.name)}</strong>. Nội dung thực hiện được tổng hợp như sau:
            </p>

            <section class="summary-grid">
              <div class="summary-card">
                <div class="label">Tổng milestone</div>
                <div class="value">${contract.stats.milestoneCount}</div>
              </div>
              <div class="summary-card">
                <div class="label">Hoàn tất / chấp nhận</div>
                <div class="value">${contract.stats.completedMilestones}</div>
              </div>
              <div class="summary-card">
                <div class="label">Completion rate</div>
                <div class="value">${contract.stats.completionRate}%</div>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th class="center">STT</th>
                  <th>Hạng mục</th>
                  <th class="center">Trạng thái</th>
                  <th class="center">Hạn</th>
                  <th class="center">Hoàn tất</th>
                  <th class="right">Giá trị</th>
                </tr>
              </thead>
              <tbody>
                ${
                  milestoneRows ||
                  `<tr><td colspan="6" class="center muted">Chưa có milestone nào được ghi nhận cho hợp đồng này.</td></tr>`
                }
              </tbody>
            </table>

            <section class="grid-2" style="margin-top: 18px;">
              <div class="note-card">
                <div class="section-label">Tổng hợp thương mại</div>
                <div class="note-text">
                  Giá trị hợp đồng: <strong>${formatCurrency(contract.value)}</strong><br />
                  Tổng đã thanh toán: <strong>${formatCurrency(contract.stats.paidAmount)}</strong><br />
                  Còn phải thu: <strong>${formatCurrency(contract.stats.outstandingAmount)}</strong><br />
                  Trạng thái hợp đồng: <strong>${escapeHtml(CONTRACT_LABELS[contract.status])}</strong>
                </div>
              </div>
              <div class="note-card">
                <div class="section-label">Nhật ký thanh toán gần nhất</div>
                ${
                  paymentRows
                    ? `<table class="compact-table"><thead><tr><th>Ngày</th><th>Phương thức</th><th>Tham chiếu</th><th class="right">Số tiền</th></tr></thead><tbody>${paymentRows}</tbody></table>`
                    : `<div class="note-text">Chưa ghi nhận thanh toán nào cho hợp đồng này.</div>`
                }
              </div>
            </section>

            ${
              contract.notes
                ? `
                  <section class="note-card" style="margin-top: 18px;">
                    <div class="section-label">Ghi chú hợp đồng</div>
                    <div class="note-text">${multilineHtml(contract.notes)}</div>
                  </section>
                `
                : ""
            }

            <section class="signature-grid">
              <div class="signature-box">
                <div class="section-label">Đại diện AHSO</div>
                <div class="signature-line">Ký, ghi rõ họ tên</div>
              </div>
              <div class="signature-box">
                <div class="section-label">Đại diện khách hàng</div>
                <div class="signature-line">Ký, ghi rõ họ tên</div>
              </div>
            </section>
          </div>
        </body>
      </html>
    `;
  }

  private resolveAcceptanceDate(contract: ContractPdfData) {
    const completedMilestones = contract.milestones
      .map((milestone) => milestone.completedAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime());

    return completedMilestones[0] ?? new Date();
  }
}

const MILESTONE_LABELS = {
  PENDING: "Chờ triển khai",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Hoàn tất",
  ACCEPTED: "Đã nghiệm thu"
} as const;

const CONTRACT_LABELS = {
  ACTIVE: "Hiệu lực",
  SUSPENDED: "Tạm dừng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Hủy"
} as const;

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
    thead tr { background: #1A5276; color: #ffffff; }
    th { padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; }
    td { padding: 10px 12px; border-top: 1px solid #E5E7EB; vertical-align: top; }
    tbody tr:nth-child(even) { background: #F8FAFC; }
    .item-name { font-weight: 700; color: #1C2833; }
    .center { text-align: center; }
    .right { text-align: right; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .note-card { border: 1px solid #D5D8DC; border-radius: 16px; background: #F8FAFC; padding: 14px 16px; }
    .note-text { margin-top: 10px; color: #5D6D7E; line-height: 1.7; }
    .compact-table { margin-top: 10px; font-size: 11px; }
    .compact-table th, .compact-table td { padding: 8px 10px; }
  `;
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

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}
