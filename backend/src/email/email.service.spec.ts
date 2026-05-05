import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import { SettingsService } from "../settings/settings.service";
import { EmailService } from "./email.service";

jest.mock("fs/promises", () => ({
  readFile: jest.fn()
}));

describe("EmailService", () => {
  let service: EmailService;
  let mailerService: {
    sendMail: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let settingsService: {
    getCompanyInfo: jest.Mock;
    getPolicies: jest.Mock;
    getLogoUrl: jest.Mock;
  };

  beforeEach(() => {
    mailerService = {
      sendMail: jest.fn().mockResolvedValue({ messageId: "mail-1" })
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === "SMTP_HOST") {
          return "smtp.example.com";
        }
        if (key === "SMTP_FROM") {
          return "AHSO <noreply@ahso.vn>";
        }
        if (key === "FRONTEND_URL") {
          return "http://localhost:3000";
        }

        return undefined;
      })
    };
    settingsService = {
      getCompanyInfo: jest.fn().mockResolvedValue({
        name: "AHSO CRM"
      }),
      getPolicies: jest.fn().mockResolvedValue({}),
      getLogoUrl: jest.fn().mockResolvedValue(null)
    };
    (readFile as jest.Mock).mockResolvedValue("<p>Xin chào {{userName}}</p>");

    service = new EmailService(
      mailerService as unknown as MailerService,
      configService as unknown as ConfigService,
      settingsService as unknown as SettingsService
    );
  });

  it("renders template and sends email when SMTP is configured", async () => {
    await expect(
      service.sendEmail("admin@ahso.vn", "Welcome", "welcome", {
        userName: "Admin"
      })
    ).resolves.toEqual({
      success: true,
      recipients: ["admin@ahso.vn"]
    });

    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["admin@ahso.vn"],
        subject: "Welcome",
        html: expect.stringContaining("Xin chào Admin")
      })
    );
  });
});
