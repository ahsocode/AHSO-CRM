import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermissions } from "src/common/decorators/permissions.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { ZodValidationPipe } from "src/common/pipes/zod-validation.pipe";
import { SettingsService } from "./settings.service";
import {
  CompanySettingInput,
  CompanySettingSchema,
  PolicySettingInput,
  PolicySettingSchema
} from "./dto/update-setting.dto";

@Controller("settings")
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  /**
   * GET /settings
   * Get all settings (public, no auth required for now)
   */
  @Get()
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  /**
   * GET /settings/company
   * Get company information
   */
  @Public()
  @Get("company")
  async getCompanyInfo() {
    return this.settingsService.getCompanyInfo();
  }

  /**
   * PATCH /settings/company
   * Update company information (admin-only)
   */
  @Patch("company")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("settings.edit")
  async updateCompanyInfo(
    @Body(new ZodValidationPipe(CompanySettingSchema)) input: CompanySettingInput
  ) {
    return this.settingsService.updateCompanyInfo(input);
  }

  /**
   * GET /settings/policies
   * Get policy settings
   */
  @Get("policies")
  async getPolicies() {
    return this.settingsService.getPolicies();
  }

  /**
   * PATCH /settings/policies
   * Update policy settings (admin-only)
   */
  @Patch("policies")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("settings.edit")
  async updatePolicies(
    @Body(new ZodValidationPipe(PolicySettingSchema)) input: PolicySettingInput
  ) {
    return this.settingsService.updatePolicies(input);
  }

  /**
   * GET /settings/logo
   * Get logo URL
   */
  @Public()
  @Get("logo")
  async getLogoUrl() {
    return this.settingsService.getLogoUrl();
  }

  /**
   * GET /settings/:key
   * Get a specific setting by key
   */
  @Get(":key")
  async getSetting(@Param("key") key: string) {
    return this.settingsService.getSetting(key);
  }

  /**
   * PATCH /settings/:key
   * Update a specific setting (admin-only)
   */
  @Patch(":key")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("settings.edit")
  async updateSetting(@Param("key") key: string, @Body("value") value: any) {
    return this.settingsService.upsertSetting(key, value);
  }
}
