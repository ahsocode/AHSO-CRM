import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/prisma.service";
import { UploadService } from "src/upload/upload.service";
import { CompanySettingInput, PolicySettingInput } from "./dto/update-setting.dto";

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private readonly uploadService: UploadService
  ) {}

  /**
   * Get all settings as key-value pairs
   */
  async getFlatSettings() {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, any> = {};

    for (const setting of settings) {
      result[setting.key] = JSON.parse(setting.value);
    }

    return result;
  }

  /**
   * Get settings grouped by domain for admin panel consumption
   */
  async getAllSettings() {
    const [company, policies, logo] = await Promise.all([
      this.getCompanyInfo(),
      this.getPolicies(),
      this.getLogoUrl()
    ]);

    return {
      company,
      policies,
      logo
    };
  }

  /**
   * Get a single setting by key
   */
  async getSetting(key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    return {
      key: setting.key,
      value: JSON.parse(setting.value),
      description: setting.description,
    };
  }

  /**
   * Update or create a setting
   */
  async upsertSetting(key: string, value: any, description?: string) {
    return this.prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify(value),
        description,
      },
      update: {
        value: JSON.stringify(value),
        ...(description && { description }),
      },
    });
  }

  /**
   * Update company info settings
   */
  async updateCompanyInfo(input: CompanySettingInput) {
    const updates = Object.entries(input).map(([key, value]) =>
      this.upsertSetting(`company:${key}`, value, `Company ${key}`)
    );

    await Promise.all(updates);

    return this.getCompanyInfo();
  }

  /**
   * Get company info
   */
  async getCompanyInfo() {
    const settings = await this.getFlatSettings();
    const companyKeys = Object.keys(settings).filter((k) =>
      k.startsWith("company:")
    );

    const result: Record<string, any> = {};
    for (const key of companyKeys) {
      const fieldName = key.replace("company:", "");
      result[fieldName] = settings[key];
    }

    return result;
  }

  /**
   * Update policy settings
   */
  async updatePolicies(input: PolicySettingInput) {
    const updates = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        this.upsertSetting(`policy:${key}`, value, `Policy ${key}`)
      );

    await Promise.all(updates);

    return this.getPolicies();
  }

  /**
   * Get policy settings
   */
  async getPolicies() {
    const settings = await this.getFlatSettings();
    const policyKeys = Object.keys(settings).filter((k) =>
      k.startsWith("policy:")
    );

    const result: Record<string, any> = {};
    for (const key of policyKeys) {
      const fieldName = key.replace("policy:", "");
      result[fieldName] = settings[key];
    }

    return result;
  }

  /**
   * Get logo URL
   */
  async getLogoUrl() {
    const logo = await this.prisma.setting.findUnique({
      where: { key: "logo:url" },
    });

    if (!logo) {
      return null;
    }

    const storedValue = JSON.parse(logo.value) as string;

    if (typeof storedValue !== "string" || !storedValue) {
      return null;
    }

    if (!storedValue.startsWith("/uploads/")) {
      return storedValue;
    }

    const dataUrl = await this.uploadService.readFileAsDataUrl(storedValue);
    return dataUrl ?? storedValue;
  }

  /**
   * Update logo URL
   */
  async updateLogoUrl(url: string) {
    await this.upsertSetting("logo:url", url, "Company logo URL");
    return { url };
  }
}
