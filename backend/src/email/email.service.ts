import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailerService } from "@nestjs-modules/mailer";
import { readFile } from "fs/promises";
import Handlebars from "handlebars";
import { join } from "path";
import { SettingsService } from "../settings/settings.service";

export type EmailTemplateName =
  | "welcome"
  | "password-reset"
  | "quote-sent"
  | "contract-signed"
  | "milestone-reminder"
  | "payment-due";

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService
  ) {}

  async sendEmail(
    to: string | string[],
    subject: string,
    template: EmailTemplateName,
    context: Record<string, unknown>,
    attachments: EmailAttachment[] = []
  ) {
    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

    if (recipients.length === 0) {
      return {
        success: false,
        skipped: true,
        reason: "Không có người nhận hợp lệ"
      };
    }

    const smtpHost = this.configService.get<string>("SMTP_HOST");
    const smtpFrom = this.configService.get<string>("SMTP_FROM");

    if (!smtpHost || !smtpFrom) {
      this.logger.warn(`Bỏ qua gửi email "${subject}" vì SMTP chưa được cấu hình đầy đủ.`);
      return {
        success: false,
        skipped: true,
        reason: "SMTP chưa được cấu hình"
      };
    }

    const html = await this.renderTemplate(template, context);
    await this.mailerService.sendMail({
      to: recipients,
      from: smtpFrom,
      subject,
      html,
      attachments: attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }))
    });

    return {
      success: true,
      recipients
    };
  }

  async buildBaseContext() {
    const [company, policies, logo] = await Promise.all([
      this.settingsService.getCompanyInfo(),
      this.settingsService.getPolicies(),
      this.settingsService.getLogoUrl()
    ]);

    return {
      company: {
        name: company.name ?? "AHSO CRM",
        shortName: company.shortName ?? "AHSO",
        taxId: company.taxId ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        website: company.website ?? ""
      },
      policies,
      logoUrl: logo ?? null,
      frontendUrl: this.resolveFrontendUrl()
    };
  }

  private async renderTemplate(template: EmailTemplateName, context: Record<string, unknown>) {
    const templatePath = join(__dirname, "templates", `${template}.hbs`);
    const source = await readFile(templatePath, "utf8");
    const compiler = Handlebars.compile(source);
    const baseContext = await this.buildBaseContext();

    return compiler({
      ...baseContext,
      ...context
    });
  }

  private resolveFrontendUrl() {
    return (
      this.configService.get<string>("FRONTEND_URL") ??
      (this.configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000")
        .split(",")
        .map((origin) => origin.trim())
        .find(Boolean) ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }
}
